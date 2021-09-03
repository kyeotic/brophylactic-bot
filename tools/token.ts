import { initContext } from '../src/context.ts'

console.log(await initContext().firebaseClient.getToken())
