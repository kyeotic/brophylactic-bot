import { nanoid, AWSSignerV4 } from '../deps.ts'

import type config from '../config.ts'

export type WorkflowConfig = typeof config['workflow']

export class WorkflowClient {
  private signer: AWSSignerV4
  private config: WorkflowConfig

  constructor({ config }: { config: WorkflowConfig }) {
    this.config = config

    this.signer = new AWSSignerV4(config.region, {
      awsAccessKeyId: config.accessKeyId,
      awsSecretKey: config.secretAccessKey,
    })
  }

  async startLottery(input: unknown): Promise<void> {
    await this.send('StartExecution', input)
  }

  async send(action: 'StartExecution' | 'DescribeExecution', body: unknown): Promise<void> {
    const encoded = new TextEncoder().encode(
      JSON.stringify({
        name: nanoid(),
        stateMachineArn: this.config.stepFunctionArn,
        input: JSON.stringify(body),
      })
    )

    await fetch(
      await this.signer.sign(
        'states',
        new Request(`https://states.${this.config.region}.amazonaws.com`, {
          method: 'POST',
          headers: {
            'content-length': encoded.length.toString(),
            'Content-Type': 'application/x-amz-json-1.0',
            'X-Amz-Target': 'AWSStepFunctions.' + action,
          },
          body: encoded,
        })
      )
    )
  }
}
