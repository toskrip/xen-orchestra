import createLogger from '@xen-orchestra/log'
import oflib from 'oflib-node/lib/oflib'
// import ofp from 'oflib-node/lib/ofp'
import ofpp from 'oflib-node/lib/ofp-1.1/ofp'
import util from 'util'
import { Stream } from 'oflib-node'

// =============================================================================

const log = createLogger('xo:xo-server:sdn-controller:openflow-controller')
const version = '1.1'

// OpenFlow message type
const OPENFLOW_PORT = 6653
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

// OpenFlow command
// const ADD = 'OFPFC_ADD'
// const MODIFY = 'OFPFC_MODIFY'
// const MODIFY_STRICT = 'OFPFC_MODIFY_STRICT'
// const DELETE = 'OFPFC_DELETE'
// const DELETE_STRICT = 'OFPFC_DELETE_STRICT'

// -----------------------------------------------------------------------------

const toType = {
  [HELLO]: 'ofp_header',
  [FEATURES_REQUEST]: 'ofp_header',
  [ECHO_REPLY]: 'ofp_header',
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
  }

  // ---------------------------------------------------------------------------

  _processMessage(message) {
    if (message.message === undefined) {
      log.error('Failed to get header while processing message', {
        message: util.inspect(message),
      })
      return
    }

    const ofType = message.message.header.type
    switch (ofType) {
      case HELLO:
        this._sendPacket(this._syncMessage(ofType, message))
        this._sendPacket(this._syncMessage(FEATURES_REQUEST, message))
        break
      case ERROR:
        {
          const { code, data, type } = message.message
          log.error('OpenFlow error', { code, type, data })
        }
        break
      case ECHO_REQUEST:
        this._sendPacket(this._syncMessage(ECHO_REPLY, message))
        break
      case PACKET_IN:
        log.info('PACKET_IN')
        break
      case FEATURES_REPLY:
        log.info('FEATURES_REPLY')
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

  _addFlow() {
    // TODO
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

  _flowModMessage(obj, flow, command, out_port) {
    return {
      version,
      header: {
        type: FLOW_MOD,
        xid: obj.message.header.xid,
      },
      body: {
        command,
        hard_timeout: 0,
        idle_timeout: 100,
        priority: 0x8000,
        buffer_id: obj.message.body.buffer_id,
        out_port: 'OFPP_NONE',
        flags: ['OFPFF_SEND_FLOW_REM'],
        match: {
          header: {
            type: 'OFPMT_STANDARD',
          },
          body: {
            wildcards: 0,
            in_port: flow.in_port,
            dl_src: flow.dl_src,
            dl_dst: flow.dl_dst,
            dl_vlan: flow.dl_vlan,
            dl_vlan_pcp: flow.dl_vlan_pcp,
            dl_type: flow.dl_type,
            nw_proto: flow.nw_proto,
            nw_src: flow.nw_src,
            nw_dst: flow.nw_dst,
            tp_src: flow.tp_src,
            tp_dst: flow.tp_dst,
          },
        },
        actions: {
          header: {
            type: 'OFPAT_OUTPUT',
          },
          body: {
            port: out_port,
          },
        },
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

  async _sendPacket(packet) {
    const socket = await this._connect()
    const buf = Buffer.alloc(ofpp.sizes[toType[packet.header.type]])

    const pack = oflib.pack(packet, buf, 0)
    if ('error' in pack) {
      log.error('Error while sending packing', { error: util.inspect(pack) })
      return
    }

    socket.write(buf)
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
          this._processMessage(msg)
        } else {
          log.error('Error: Message is unparseable', { msg })
        }
      })
      socket.destroy()
    })
    return socket
  }
}
