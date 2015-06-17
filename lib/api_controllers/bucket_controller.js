'use strict';

var routes;
var Model = require('hoist-model');
var Boom = require('boom');
var Context = require('hoist-context');
var errors = require('hoist-errors');
var logger = require('hoist-logger');
var pipeline = require('hoist-bucket-pipeline')(Context, Model);

function BucketController() {

}

BucketController.prototype.getBucket = function(req, reply) {
  if (!req.params.key) {
    throw new errors.Http404Error('no bucket key');
  }
  pipeline.get(req.params.key).then(function (bucket) {
    if (!bucket) {
      throw new errors.Http404Error('bucket not found @ ' + req.params.key);
    }
    reply(bucket.toObject());
  }).catch(function (err) {
    if (!errors.isHoistError(err)) {
      logger.error(err);
      err = new errors.hoistError();
    }
    reply(Boom.wrap(err, parseInt(err.code)));
  });
};

BucketController.prototype.getRoutes = function () {
  return routes;
};

var eventPrefix = '/bucket';
var controller = new BucketController();
routes = [
  {
    // GET /bucket/
    path: eventPrefix + '/{key}',
    method: ['GET'],
    handler: controller.getBucket,
    config: {
      auth: 'hoist',
      bind: controller
    }}];

module.exports = controller;
