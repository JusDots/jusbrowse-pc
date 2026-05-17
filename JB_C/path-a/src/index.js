const { AuthBroker } = require("./auth/AuthBroker");
const { PathAAuthBroker } = require("./auth/PathAAuthBroker");
const { AuthFlowStateMachine } = require("./auth/AuthFlowStateMachine");
const { AUTH_FLOW_STATES, AUTH_FLOW_REASONS } = require("./auth/AuthFlowReasons");
const {
  AUTH_TELEMETRY_EVENTS,
  AUTH_TELEMETRY_SCHEMA,
  validateTelemetryEvent,
  buildTelemetryEvent
} = require("./telemetry/authTelemetrySchema");
const { AuthTelemetryBuffer } = require("./telemetry/AuthTelemetryBuffer");
const { resolveProviderPolicy, shouldForceExternalHandoff } = require("./compatibility/providerCompatibilityPolicy");
const { ElectronAuthFlowBridge } = require("./adapters/electron/ElectronAuthFlowBridge");
const { createPkcePair, createStateToken } = require("./auth/pkce");

module.exports = {
  AuthBroker,
  PathAAuthBroker,
  AuthFlowStateMachine,
  AUTH_FLOW_STATES,
  AUTH_FLOW_REASONS,
  AUTH_TELEMETRY_EVENTS,
  AUTH_TELEMETRY_SCHEMA,
  validateTelemetryEvent,
  buildTelemetryEvent,
  AuthTelemetryBuffer,
  resolveProviderPolicy,
  shouldForceExternalHandoff,
  ElectronAuthFlowBridge,
  createPkcePair,
  createStateToken
};
