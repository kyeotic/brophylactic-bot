/* eslint-disable no-console */
import { redeploy } from './discord/redeploy.js'

redeploy().catch((e) => {
  console.error('redeploy error', e)
})
