import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import path from 'path';
import assert from 'assert';
import feathers from 'feathers';
import NeDB from 'nedb';
import { base, example } from 'feathers-service-tests';
import errors from 'feathers-errors';

import server from './test-app';
import service from '../src';

chai.use(chaiAsPromised);

function createService (name, options) {
  // NeDB ids do not seem to be generated sequentially but sorted lexigraphically
  // if no other sort order is given. This means that items can not be returned in the
  // same order they have been created so this counter is used for sorting instead.
  let counter = 0;

  const filename = path.join('db-data', name);
  const db = new NeDB({ filename, autoload: true });

  return service(Object.assign({ Model: db }, options)).extend({
    _find (params) {
      params.query = params.query || {};
      if (!params.query.$sort) {
        params.query.$sort = { counter: 1 };
      }

      return this._super.apply(this, arguments);
    },

    create (raw, params) {
      const convert = item => Object.assign({}, item, { counter: ++counter });
      const items = Array.isArray(raw) ? raw.map(convert) : convert(raw);

      return this._super(items, params);
    }
  });
}

describe('NeDB Service', function () {
  const app = feathers()
    .use('/people', createService('people', {
      events: [ 'testing' ]
    })).use('/people-customid', createService('people-customid', {
      id: 'customid',
      events: [ 'testing' ]
    }));

  describe('Initialization', () => {
    it('throws an error when missing options', () =>
      expect(service.bind(null)).to
        .throw('NeDB options have to be provided')
    );

    it('throws an error when missing a Model', () =>
      expect(service.bind(null, {})).to
        .throw('NeDB datastore `Model` needs to be provided')
    );
  });

  describe('Common functionality', () => {
    it('is CommonJS compatible', () =>
      assert.ok(typeof require('../lib') === 'function')
    );

    base(app, errors, 'people', '_id');
    base(app, errors, 'people-customid', 'customid');
  });

  describe('Service update', () => {
    it('should respect NeDB upsert option', () => {
      const myService = app.service('/people');

      return expect(myService.update('upsertion-test', {}, {nedb: {upsert: true}})).to.be.fulfilled;
    });
  });
});

describe('NeDB service example test', () => {
  after(done => server.close(() => done()));

  example('_id');
});
