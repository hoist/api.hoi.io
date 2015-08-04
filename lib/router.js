'use strict';

import EventController from './api_controllers/event_controller';
import BucketController from './api_controllers/bucket_controller';
import HealthCheckController from './api_controllers/health_check_controller';

/**
 * map routes for this server
 */
class Router {

  /**
   * map the routes to the server
   * @param {HapiServer} server
   */
  map(server) {
    this._eventController = new EventController();
    this._bucketController = new BucketController();
    this._healthCheckController = new HealthCheckController();
    this._healthCheckController.mapRoutes(server);
    this._eventController.mapRoutes(server);
    this._bucketController.mapRoutes(server);
    server.route({
      method: 'GET',
      path: '/',
      handler: function (request, reply) {
        reply.file('./docs/index.html');
      }
    });
  }
}

export default Router;
