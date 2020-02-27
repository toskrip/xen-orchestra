import createLogger from '@xen-orchestra/log'
import oflib from 'oflib-node/lib/oflib'
// import ofp from 'oflib-node/lib/ofp'
import ofpp from 'oflib-node/lib/ofp-1.1/ofp'
import util from 'util'
import { Stream } from 'oflib-node'

// =============================================================================

const log = createLogger('xo:xo-server:sdn-controller:openflow-controller')

const OPENFLOW_PORT = 6653
const version = '1.1'

// OpenFlow message type
const HELLO = 'OFPT_HELLO'
const ERROR = 'OFPT_ERROR'
const ECHO_REQUEST = 'OFPT_ECHO_REQUEST'
const ECHO_REPLY = 'OFPT_ECHO_REPLY'
const PACKET_IN = 'OFPT_PACKET_IN'
// const PACKET_OUT = 'OFPT_PACKET_OUT'
const FEATURES_REQUEST = 'OFPT_FEATURES_REQUEST'
const FEATURES_REPLY = 'OFPT_FEATURES_REPLY'
const PORT_STATUS = 'OFPT_PORT_STATUS'
const FLOW_MOD = 'OFPT_FLOW_MOD'
const FLOW_REMOVED = 'OFPT_FLOW_REMOVED'
const CONFIG_REQUEST = 'OFPT_GET_CONFIG_REQUEST'
const CONFIG_REPLY = 'OFPT_GET_CONFIG_REPLY'

// OpenFlow command
const ADD = 'OFPFC_ADD'
// const MODIFY = 'OFPFC_MODIFY'
// const MODIFY_STRICT = 'OFPFC_MODIFY_STRICT'
// const DELETE = 'OFPFC_DELETE'
// const DELETE_STRICT = 'OFPFC_DELETE_STRICT'

// -----------------------------------------------------------------------------

const toType = {
  [HELLO]: 'ofp_header',
  [FEATURES_REQUEST]: 'ofp_header',
  [ECHO_REPLY]: 'ofp_header',
  [FLOW_MOD]: 'ofp_desc_stats',
  [CONFIG_REQUEST]: 'ofp_switch_config',
}

// =============================================================================

export class OpenFlowChannel {
  /*
  Create an SSL connection to an XCP-ng host.
  Interact with the host's OpenVSwitch (OVS) daemon to manage its flows.
  See:
  - OpenFlow spec: https://www.opennetworking.org/wp-content/uploads/2013/04/openflow-spec-v1.0.0.pdf
  */

  constructor(host, tlsHelper) {
    this.host = host
    this._tlsHelper = tlsHelper
    this._stream = new Stream()

    log.debug('New OpenFlow channel', {
      host: this.host.name_label,
    })

    log.info('********************', { ofpp })
  }

  // ---------------------------------------------------------------------------

  _processMessage(message, socket) {
    if (message.message === undefined) {
      log.error('Failed to get header while processing message', {
        message: util.inspect(message),
      })
      return
    }

    log.info('*** MESSAGE RECEIVED', { message: message.message })
    const ofType = message.message.header.type
    switch (ofType) {
      case HELLO:
        this._sendPacket(this._syncMessage(ofType, message), socket)
        this._sendPacket(this._syncMessage(FEATURES_REQUEST, message), socket)
        break
      case ERROR:
        {
          const { code, data, type } = message.message.body
          log.error('OpenFlow error', { code, type, data: oflib.unpack(data) })
        }
        break
      case ECHO_REQUEST:
        this._sendPacket(this._syncMessage(ECHO_REPLY, message), socket)
        break
      case PACKET_IN:
        log.info('PACKET_IN')
        break
      case FEATURES_REPLY:
        {
          const {
            datapath_id: dpid,
            capabilities,
            ports,
          } = message.message.body
          log.info('FEATURES_REPLY', { dpid, capabilities, ports })
          this._sendPacket(this._syncMessage(CONFIG_REQUEST, message), socket)
        }
        break
      case CONFIG_REPLY:
        {
          const { flags } = message.message.body
          log.info('CONFIG_REPLY', { flags })
          this._addFlow(
            {
              dl_type: 'ip',
              dl_src: 'fe:ff:ff:ff:ff:ff',
              nw_src: '192.168.5.242',
              tp_dst: 5060,
            },
            socket
          )
        }
        break
      case PORT_STATUS:
        log.info('PORT_STATUS')
        break
      case FLOW_REMOVED:
        log.info('FLOW_REMOVED')
        break
      default:
        log.error('Unknown OpenFlow type', { ofType })
        break
    }
  }

  _addFlow(flow, socket) {
    // TODO
    const packet = this._flowModMessage(flow, ADD)
    this._sendPacket(packet, socket)
    log.info('*** ADDING', {
      packet,
      actions: packet.body.instructions[0].body.actions[0],
      match: packet.body.match,
    })
  }

  _removeFlows() {
    // TODO
  }

  // ---------------------------------------------------------------------------

  _syncMessage(type, obj) {
    return {
      version,
      header: {
        type,
        xid: obj.message.header.xid ?? 1,
      },
      body: {},
    }
  }

  _flowModMessage(flow, command, out_port = 0) {
    return {
      version,
      header: {
        type: FLOW_MOD,
        length: 160,
        xid: 1,
      },
      body: {
        command,
        hard_timeout: 0,
        idle_timeout: 100,
        priority: 0x8000,
        out_port: 0xffff,
        flags: ['OFPFF_SEND_FLOW_REM'],
        match: {
          header: {
            type: 'OFPMT_STANDARD',
          },
          body: {
            wildcards: 0,
            in_port: 1,
            dl_src: flow.dl_src,
            dl_type: 2048,
            tp_dst: flow.tp_dst,
            nw_src: flow.nw_src,

            dl_dst: '00:00:00:00:00:00',
            nw_proto: '0.0.0.0',
            nw_dst: '0.0.0.0',
            tp_src: 0,
          },
        },
        instructions: [
          {
            header: { type: 'OFPIT_WRITE_ACTIONS', len: 16 },
            body: {
              actions: [
                {
                  header: {
                    type: 'OFPAT_OUTPUT',
                  },
                  body: {
                    port: 0xffff,
                  },
                },
              ],
            },
          },
        ],
      },
    }
  }

  _extractFlow(packet) {
    return {
      dl_src: packet.shost,
      dl_dst: packet.dhost,
      dl_type: packet.ethertype,

      dl_vlan: packet.vlan ?? 0xffff,
      dl_vlan_pcp: packet.vlan !== undefined ? packet.priority : 0,

      nw_src: packet.ip !== undefined ? packet.ip.saddr : '0.0.0.0',
      nw_dst: packet.ip !== undefined ? packet.ip.daddr : '0.0.0.0',
      nw_proto: packet.ip !== undefined ? packet.ip.protocol : 0,

      tp_src:
        packet.ip.tcp !== undefined || packet.ip.udp !== undefined
          ? packet.ip.saddr
          : packet.ip.icmp !== undefined
          ? packet.ip.icmp.type
          : '0.0.0.0',
      tp_dst:
        packet.ip.tcp !== undefined || packet.ip.udp !== undefined
          ? packet.ip.daddr
          : packet.ip.icmp !== undefined
          ? packet.ip.icmp.code
          : '0.0.0.0',
    }
  }

  // ---------------------------------------------------------------------------

  async _sendPacket(packet, socket) {
    const size =
      packet.header.type === FLOW_MOD
        ? 160
        : ofpp.sizes[toType[packet.header.type]]
    log.info('BUFFER SIZE', { size })
    const buf = Buffer.alloc(size)
    packet.header.length = size

    const pack = oflib.pack(packet, buf, 0)
    if ('error' in pack) {
      log.error('Error while packing packet to send', {
        error: util.inspect(pack),
      })
      return
    }

    log.info('*** SENDING', { packet, pack })
    const unpacked = oflib.unpack(buf)
    if (packet.header.type === FLOW_MOD) {
      log.info('*** SENDING 2', {
        header: unpacked.message.header,
        match: unpacked.message.body.match,
        instruction: unpacked.message.body.instructions[0].body,
        actions: unpacked.message.body.instructions[0].body.actions[0],
      })
    }
    try {
      socket.write(buf)
    } catch (error) {
      log.error('Error while writing into socket', {
        error,
        host: this.host.name_label,
      })
    }
  }

  // ---------------------------------------------------------------------------

  async _connect() {
    const socket = await this._tlsHelper.connect(
      this.host.address,
      OPENFLOW_PORT
    )
    socket.on('data', data => {
      const msgs = this._stream.process(data)
      msgs.forEach(msg => {
        if (msg.message !== undefined) {
          this._processMessage(msg, socket)
        } else {
          log.error('Error: Message is unparseable', { msg })
        }
      })
    })
    return socket
  }
}
