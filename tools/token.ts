import { initContext } from '../src/di.ts'

console.log(await initContext().firebaseClient.getToken())
