/* eslint-disable no-console */
import { redeploy } from './discord/redeploy'

redeploy().catch((e) => {
  console.error('redeploy error', e)
})
