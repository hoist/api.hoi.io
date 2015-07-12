'use strict';

import Boom from 'boom';
import errors from '@hoist/errors';
import logger from '@hoist/logger';
import BucketPipeline from '@hoist/bucket-pipeline';

/**
 * controlls api routes under /bucket
 */

class BucketController {
  /**
   * construct a new BucketController
   */
  constructor() {
    this._logger = logger.child({
      cls: this.constructor.name
    });
    this._pipeline = new BucketPipeline();
  }

  /**
   * get a single bucket
   * @param {Request} req - the Hapi Request object
   * @param {Reply} reply - the Hapi Reply object
   * @returns {Promise}
   */
  getBucket(req, reply) {
    if (!req.params.key) {
      throw new errors.Http404Error('no bucket key');
    }
    this._logger.info('retrieving bucket');

    return this._pipeline.get(req.auth.credentials, req.params.key).then((bucket) => {

      if (!bucket) {
        this._logger.info('unable to find bucket');
        throw new errors.Http404Error('bucket not found @ ' + req.params.key);
      }
      this._logger.info('found bucket');
      reply(bucket);
    }).catch((err) => {
      this._logger.error(err);
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
    this._logger.info('mapping server routes');
    let routePrefix = '/bucket';
    server.route({
      // GET /bucket/
      path: routePrefix + '/{key}',
      method: ['GET'],
      handler: this.getBucket,
      config: {
        auth: 'hoist',
        bind: this
      }
    });
  }

}



export default BucketController;
