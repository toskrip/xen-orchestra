import createLogger from '@xen-orchestra/log'
// import oflib from 'oflib-node'
// import ofp from 'oflib-node/lib/ofp'
// import ofpp from 'oflib-node/lib/ofp-1.0/ofp'

// =============================================================================

const log = createLogger('xo:xo-server:sdn-controller:openflow-controller')

const OPENFLOW_PORT = 6653

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

    log.debug('New OpenFlow channel', {
      host: this.host.name_label,
    })
  }

  // ---------------------------------------------------------------------------

  _processMessage() {
    /* TODO
    if () {
      // Error
      return
    }
    */

    const type = '' // TODO
    switch (type) {
      case 'OFPT_HELLO':
        break
      case 'OFPT_ERROR':
        break
      case 'OFPT_ECHO_REQUEST':
        break
      case 'OFPT_PACKET_IN':
        break
      case 'OFPT_FEATURES_REPLY':
        break
      case 'OFPT_PORT_STATUS':
        break
      case 'OFPT_FLOW_REMOVED':
        break
      default:
        break
    }
  }

  // ---------------------------------------------------------------------------

  _connect() {
    return this._tlsHelper.connect(this.host.address, OPENFLOW_PORT)
  }
}
