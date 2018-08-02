import { parse } from 'shell-quote'

export default function safeShellParse(input: string): string[] {
  let output = parse(input)

  // Shell operators are returned as objects
  // Ensure we didn't get any
  if (!output.every(c => typeof c === 'string')) {
    throw new Error('Invalid Input')
  }

  return output as string[]
}
