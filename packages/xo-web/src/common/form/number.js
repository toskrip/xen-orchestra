import PropTypes from 'prop-types'
import React from 'react'
import { injectState, provideState } from 'reaclette'

import decorate from '../apply-decorators'

// it provide `data-*` to add params to the `onChange`
const Number_ = decorate([
  provideState({
    initialState: ({ value }) => {
      if (value == null) {
        value = ''
      }
      return {
        value: String(value),
      }
    },
    effects: {
      onChange(_, { target: { value } }) {
        const { state, props } = this
        value = value.trim()

        let params = {}
        let empty = true
        Object.keys(props).forEach(key => {
          if (key.startsWith('data-')) {
            empty = false
            params[key.slice(5)] = props[key]
          }
        })
        params = empty ? undefined : params

        if (value === '') {
          props.onChange(undefined, params)
        } else if (!Number.isNaN(+value) && +value !== +state.value) {
          props.onChange(+value, params)
        }

        state.value = value
      },
    },
  }),
  injectState,
  ({ state, effects, className = 'form-control', ...props }) => (
    <input
      {...props}
      className={className}
      onChange={effects.onChange}
      type='number'
      value={state.value}
    />
  ),
])

Number_.propTypes = {
  onChange: PropTypes.func.isRequired,
  value: PropTypes.number,
}

export default Number_
