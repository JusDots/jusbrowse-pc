/**
 * @typedef {Object} AuthStartRequest
 * @property {string} providerKey
 * @property {string} sourceTabId
 * @property {string} initiatorUrl
 * @property {boolean} incognito
 * @property {Record<string, string>} [metadata]
 */

/**
 * @typedef {Object} AuthFlowHandle
 * @property {string} flowId
 * @property {string} providerKey
 * @property {number} startedAt
 * @property {"embedded"|"managed-tab"|"external-browser"} strategy
 */

/**
 * Provider-agnostic auth broker contract for Path A.
 *
 * Runtime adapters should depend on this interface instead of implementing
 * provider-specific auth behavior inline in Electron event handlers.
 */
class AuthBroker {
  /**
   * @param {AuthStartRequest} _request
   * @returns {Promise<AuthFlowHandle>}
   */
  async startAuthFlow(_request) {
    throw new Error("AuthBroker.startAuthFlow must be implemented by adapter.");
  }

  /**
   * @param {string} _flowId
   * @param {string} _url
   * @param {"did-navigate"|"did-redirect-navigation"|"did-navigate-in-page"} _eventName
   * @returns {Promise<void>}
   */
  async onRedirectObserved(_flowId, _url, _eventName) {
    throw new Error("AuthBroker.onRedirectObserved must be implemented by adapter.");
  }

  /**
   * @param {string} _flowId
   * @param {string} _reason
   * @returns {Promise<void>}
   */
  async completeAuthFlow(_flowId, _reason) {
    throw new Error("AuthBroker.completeAuthFlow must be implemented by adapter.");
  }

  /**
   * @param {string} _flowId
   * @param {string} _reason
   * @returns {Promise<void>}
   */
  async cancelAuthFlow(_flowId, _reason) {
    throw new Error("AuthBroker.cancelAuthFlow must be implemented by adapter.");
  }

  /**
   * @param {number} _limit
   * @returns {Promise<Array<Record<string, unknown>>>}
   */
  async getAuthDiagnostics(_limit = 100) {
    throw new Error("AuthBroker.getAuthDiagnostics must be implemented by adapter.");
  }
}

module.exports = {
  AuthBroker
};
