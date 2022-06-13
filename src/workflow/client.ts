import { nanoid } from 'nanoid'
import aws4 from 'aws4'
import request, { isErrorStatus } from 'request-micro'

import type config from '../config'
import type { AppLogger } from '../di'

export type WorkflowConfig = typeof config['workflow']

export class WorkflowClient {
  private logger: AppLogger
  private config: WorkflowConfig

  constructor({ config, logger }: { config: WorkflowConfig; logger: AppLogger }) {
    this.config = config
    this.logger = logger
  }

  async startLottery(input: unknown): Promise<void> {
    await this.send('StartExecution', input)
  }

  async send(action: 'StartExecution' | 'DescribeExecution', body: unknown): Promise<void> {
    const response = await request(
      aws4.sign(
        {
          protocol: 'https:',
          host: `states.us-west-2.amazonaws.com`,
          service: 'states',
          region: this.config.region,
          path: '/',
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-amz-json-1.0',
            'X-Amz-Target': 'AWSStepFunctions.' + action,
          },
          body: JSON.stringify({
            name: nanoid(),
            stateMachineArn: this.config.stepFunctionArn,
            input: JSON.stringify(body),
          }),
        },
        {
          accessKeyId: this.config.accessKeyId,
          secretAccessKey: this.config.secretAccessKey,
          sessionToken: this.config.sessionToken,
        }
      )
    )

    if (isErrorStatus(response)) {
      this.logger.error('Workflow error', response.data)
      throw new Error('Unable to start workflow')
    }

    this.logger.debug('workflow response', response.statusCode, response.data.toString())
  }
}
