import _ from 'intl'
import decorate from 'apply-decorators'
import PropTypes from 'prop-types'
import React from 'react'
import { confirm } from 'modal'
import { createGetObjectsOfType } from 'selectors'
import { injectState, provideState } from 'reaclette'
import { satisfies as versionSatisfies } from 'semver'

import { connectStore, noop } from './utils'

// XAPI values should be lowercased
const VM_BOOT_FIRMWARES = ['bios', 'uefi']

const SelectBootFirmware = decorate([
  connectStore({
    host: createGetObjectsOfType('host').find((_, { host: id }) => ({ id })),
  }),
  provideState({
    effects: {
      handleBootFirmwareChange(__, { target: { value } }) {
        if (
          value !== '' &&
          versionSatisfies(this.props.host.version, '8.0.0')
        ) {
          // Guest UEFI boot is provided in CH/XCP-ng 8.0 as an experimental feature.
          confirm({
            title: _('vmBootFirmware'),
            body: _('vmBootFirmwareWarningMessage'),
          }).then(() => this.props.onChange(value), noop)
        } else {
          this.props.onChange(value)
        }
      },
    },
  }),
  injectState,
  ({ effects, value }) => (
    <select
      className='form-control'
      onChange={effects.handleBootFirmwareChange}
      value={value}
    >
      <option value=''>{_('vmDefaultBootFirmwareLabel')}</option>
      {VM_BOOT_FIRMWARES.map(val => (
        <option key={val} value={val}>
          {val}
        </option>
      ))}
    </select>
  ),
])

SelectBootFirmware.propTypes = {
  host: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,
}

export default SelectBootFirmware
