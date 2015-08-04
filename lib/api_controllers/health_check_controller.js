'use strict';
import logger from '@hoist/logger';
import errors from '@hoist/errors';
import Boom from 'boom';
import {
  _mongoose
}
from '@hoist/model';

/**
 * API Controller for /event endpoints
 */
class EventController {
  /**
   * create new instance
   */
  constructor() {
    this._logger = logger.child({
      cls: this.constructor.name
    });
    this._logger.info('created new event controller');
  }
  heartbeat(request, reply) {
    return Promise.resolve()
      .then(() => {
        this._logger.info('carrying out heartbeat');
        if (_mongoose.connection.readyState !== 1) {
          this._logger.info('database not connected');
          let response = reply({
            database: false,
            ok: false
          });
          response.code(500);
          return response;
        }
        this._logger.info('heartbeat ok');
        return reply({
          database: true,
          ok: true
        });
      }).catch((err) => {
        if (!errors.isHoistError(err)) {
          this._logger.error(err);
          err = new errors.HoistError();
        }
        reply(Boom.wrap(err, parseInt(err.code)));
      });
  }


  /**
   * map routes for this controller
   * @param {HapiServer} server - the Hapi Server instance
   */
  mapRoutes(server) {
    this._logger.info('mapping health check routes');
    server.route([{
      // GET /events
      path: '/api/heartbeat',
      method: ['GET'],
      handler: this.heartbeat,
      config: {
        bind: this
      }
    }]);
  }
}

export default EventController;
