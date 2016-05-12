/**
 * External dependencies
 */
import { expect } from 'chai';
import deepFreeze from 'deep-freeze';
import sinon from 'sinon';

/**
 * Internal dependencies
 */
import {
	READER_FEED_REQUEST,
	READER_FEED_REQUEST_SUCCESS,
	READER_FEED_REQUEST_FAILURE,
	SERIALIZE,
	DESERIALIZE
} from 'state/action-types';

import {
	items
} from '../reducer';

describe( 'reducer', () => {
	describe( 'items', () => {
		it( 'should return an empty map by default', () => {
			expect( items( undefined, {} ) ).to.deep.equal( {} );
		} );

		it( 'should update the state when receiving a feed', () => {
			expect(
				items( {}, {
					type: READER_FEED_REQUEST_SUCCESS,
					payload: {
						feed_ID: 1,
						blog_ID: 2
					}
				} )[ 1 ]
			).to.deep.equal( {
				feed_ID: 1,
				blog_ID: 2
			} );
		} );

		it( 'should serialize feed entries', () => {
			const unvalidatedObject = deepFreeze( { hi: 'there' } );
			expect( items( unvalidatedObject, { type: SERIALIZE } ) ).to.deep.equal( unvalidatedObject );
		} );

		it( 'should not serialize errors', () => {
			const stateWithErrors = deepFreeze( {
				12: { feed_ID: 12 },
				666: { feed_ID: 666, is_error: true }
			} );
			expect( items( stateWithErrors, { type: SERIALIZE } ) ).to.deep.equal( {
				12: { feed_ID: 12 }
			} );
		} );

		it( 'should reject deserializing entries it cannot validate', sinon.test( function() {
			const unvalidatedObject = deepFreeze( { hi: 'there' } );
			this.stub( console, 'warn' ); // stub warn to suppress the warning that validation failure emits
			expect( items( unvalidatedObject, { type: DESERIALIZE } ) ).to.deep.equal( {} );
		} ) );

		it( 'should deserialize good things', () => {
			const validState = deepFreeze( {
				1234: {
					feed_ID: 1234,
					blog_ID: 4567,
					name: 'Example Dot Com',
					URL: 'http://example.com',
					feed_URL: 'http://example.com/feed',
					subscribers_count: 10,
					is_following: false
				}
			} );
			expect( items( validState, { type: DESERIALIZE } ) ).to.deep.equal( validState );
		} );

		it( 'should stash an error object in the map if the request fails', () => {
			expect( items( {}, {
				type: READER_FEED_REQUEST_FAILURE,
				error: true,
				payload: new Error( 'request failed' ),
				meta: {
					feed_ID: 666
				}
			} ) ).to.deep.equal( {
				666: { feed_ID: 666, is_error: true }
			} );
		} );

		it( 'should overwrite an existing entry on receiving a new feed', () => {
			const startingState = deepFreeze( {
				666: { feed_ID: 666, blog_ID: 777, name: 'valid' }
			} );
			expect( items( startingState, {
				type: READER_FEED_REQUEST_SUCCESS,
				payload: {
					feed_ID: 666,
					blog_ID: 888,
					name: 'new',
					subscribers_count: 10
				}
			} ) ).to.deep.equal( {
				666: {
					feed_ID: 666,
					blog_ID: 888,
					name: 'new',
					subscribers_count: 10
				}
			} );
		} );

		it( 'should leave an existing entry alone if an error is received', () => {
			const startingState = deepFreeze( {
				666: { feed_ID: 666, blog_ID: 777, name: 'valid' }
			} );
			expect( items( startingState, {
				type: READER_FEED_REQUEST_FAILURE,
				error: true,
				payload: new Error( 'request failed' ),
				meta: {
					feed_ID: 666
				}
			} ) ).to.deep.equal( startingState );
		} );
	} );

	describe( 'isRequestingFeed', () => {
		it( 'should add to the set of feeds inflight', () => {

		} );

		it( 'should remove the feed from the set inflight', () => {

		} );
	} );
} );
