'use strict';

var eventController = require('./api_controllers/event_controller');

function Router() {

}

Router.prototype.map = function (server) {

  server.route(eventController.getRoutes());
  server.route({
    method: 'GET',
    path: '/',
    handler: function (request, reply) {
      reply.file('./docs/index.html');
    }
  });
};

module.exports = new Router();
