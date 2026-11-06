// Host half entry: the bundle patch activates lib/host.mjs, whose apply() starts the
// embedded MOKI whiteboard server and registers the whiteboard tools.
export { apply, inject } from './lib/host.mjs'
