/**
 * External dependencies
 */
import React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import page from 'page';
const debug = require( 'debug' )( 'calypso:jetpack-connect:authorize-form' );

/**
 * Internal dependencies
 */
import ConnectHeader from './connect-header';
import Main from 'components/main';
import LoggedOutFormLinks from 'components/logged-out-form/links';
import LoggedOutFormLinkItem from 'components/logged-out-form/link-item';
import SignupForm from 'components/signup-form';
import WpcomLoginForm from 'signup/wpcom-login-form';
import config from 'config';
import { createAccount, authorize, goBackToWpAdmin, activateManage } from 'state/jetpack-connect/actions';
import JetpackConnectNotices from './jetpack-connect-notices';
import observe from 'lib/mixins/data-observe';
import userUtilities from 'lib/user/utils';
import Card from 'components/card';
import CompactCard from 'components/card/compact';
import Gravatar from 'components/gravatar';
import i18n from 'lib/mixins/i18n';
import Gridicon from 'components/gridicon';
import { getSiteByUrl } from 'state/sites/selectors';

/**
 * Constants
 */

const STATS_PAGE = '/stats/insights/';
const authUrl = '/wp-admin/admin.php?page=jetpack&connect_url_redirect=true&calypso_env=' + config( 'env' );

/**
 * Module variables
 */

/***
 * Renders a header common to both the logged in and logged out forms
 * @param {String} siteUrl A site URL to display in the header
 * @param {Boolean} isConnected Is the connection complete
 * @returns {Object} The JSX for the form's header
 */
const renderFormHeader = ( siteUrl, isConnected = false ) => {
	const headerText = ( isConnected )
		? i18n.translate( 'You are connected!' )
		: i18n.translate( 'Connect your self-hosted WordPress' );
	const subHeaderText = ( isConnected )
		? i18n.translate( 'The power of WordPress.com is yours to command.' )
		: i18n.translate( 'Jetpack would like to connect to your WordPress.com account' );
	return(
		<div>
			<ConnectHeader headerText={ headerText }
					subHeaderText={ subHeaderText } />
			<CompactCard className="jetpack-connect__authorize-form-header">{ siteUrl }</CompactCard>
		</div>
	);
};

const JETPACK_CONNECT_TTL = 60 * 60 * 1000; // 1 Hour

const LoggedOutForm = React.createClass( {
	displayName: 'LoggedOutForm',

	submitForm( form, userData ) {
		debug( 'submiting new account', form, userData );
		this.props.createAccount( userData );
	},

	isSubmitting() {
		return this.props.jetpackConnectAuthorize && this.props.jetpackConnectAuthorize.isAuthorizing;
	},

	loginUser() {
		const { queryObject, userData, bearerToken } = this.props.jetpackConnectAuthorize;
		const extraFields = { jetpack_calypso_login: '1', _wp_nonce: queryObject._wp_nonce };
		return (
			<WpcomLoginForm
				log={ userData.username }
				authorization={ 'Bearer ' + bearerToken }
				extraFields={ extraFields }
				redirectTo={ window.location.href } />
		);
	},

	renderFooterLink() {
		const loginUrl = config( 'login_url' ) + '?redirect_to=' + encodeURIComponent( window.location.href );
		return (
			<LoggedOutFormLinks>
				<LoggedOutFormLinkItem href={ loginUrl }>
					{ this.translate( 'Already have an account? Sign in' ) }
				</LoggedOutFormLinkItem>
			</LoggedOutFormLinks>
		);
	},

	render() {
		const { userData } = this.props.jetpackConnectAuthorize;
		const { site } = this.props.jetpackConnectAuthorize.queryObject;
		return (
			<div>
				{ renderFormHeader( site ) }
				<SignupForm
					getRedirectToAfterLoginUrl={ window.location.href }
					disabled={ this.isSubmitting() }
					submitting={ this.isSubmitting() }
					save={ this.save }
					submitForm={ this.submitForm }
					submitButtonText={ this.translate( 'Sign Up and Connect Jetpack' ) }
					footerLink={ this.renderFooterLink() } />
				{ userData && this.loginUser() }
			</div>
		);
	}
} );

const LoggedInForm = React.createClass( {
	displayName: 'LoggedInForm',

	componentWillMount() {
		const { autoAuthorize, queryObject } = this.props.jetpackConnectAuthorize;
		debug( 'Checking for auto-auth on mount', autoAuthorize );
		if ( ! this.props.isAlreadyOnSitesList &&
			! queryObject.already_authorized &&
			( autoAuthorize || this.props.calypsoStartedConnection ) ) {
			this.props.authorize( queryObject );
		}
	},

	componentWillReceiveProps( props ) {
		const { queryObject, authorizeSuccess, isRedirectingToWpAdmin } = props.jetpackConnectAuthorize;
		if ( authorizeSuccess &&
			! isRedirectingToWpAdmin &&
			! props.calypsoStartedConnection &&
			queryObject.redirect_after_auth ) {
			this.props.goBackToWpAdmin( queryObject.redirect_after_auth );
		}
	},

	activateManage() {
		const { queryObject, activateManageSecret, plansUrl } = this.props.jetpackConnectAuthorize;
		this.props.activateManage( queryObject.client_id, queryObject.state, activateManageSecret );
		page.redirect( plansUrl );
	},

	handleSubmit() {
		const { queryObject, siteReceived, manageActivated, activateManageSecret, plansUrl, authorizeError } = this.props.jetpackConnectAuthorize;
		if ( ! this.props.isAlreadyOnSitesList &&
			queryObject.already_authorized ) {
			this.props.goBackToWpAdmin( queryObject.redirect_after_auth );
		} else if ( activateManageSecret && ! manageActivated ) {
			this.activateManage();
		} else if ( authorizeError && authorizeError.message.indexOf( 'verify_secrets_missing' ) >= 0 ) {
			window.location.href = queryObject.site + authUrl;
		} else if ( this.props.isAlreadyOnSitesList || ( siteReceived && plansUrl ) ) {
			page( plansUrl );
		} else {
			this.props.authorize( queryObject );
		}
	},

	handleSignOut() {
		const { queryObject } = this.props.jetpackConnectAuthorize;
		let redirect = window.location.href + '?';
		for ( const prop in queryObject ) {
			redirect += prop + '=' + encodeURIComponent( queryObject[ prop ] ) + '&';
		}
		userUtilities.logout( redirect );
	},

	isAuthorizing() {
		const { isAuthorizing, isActivating } = this.props.jetpackConnectAuthorize;
		return ( ! this.props.isAlreadyOnSitesList && ( isAuthorizing || isActivating ) );
	},

	renderNotices() {
		const { authorizeError, queryObject } = this.props.jetpackConnectAuthorize;
		if ( queryObject.already_authorized && ! this.props.isAlreadyOnSitesList ) {
			return <JetpackConnectNotices noticeType="alreadyConnectedByOtherUser" />;
		}

		if ( ! authorizeError ) {
			return null;
		}
		if ( authorizeError.message.indexOf( 'already_connected' ) >= 0 ) {
			return <JetpackConnectNotices noticeType="alreadyConnected" />;
		}
		if ( authorizeError.message.indexOf( 'verify_secrets_missing' ) >= 0 ) {
			return <JetpackConnectNotices noticeType="secretExpired" siteUrl={ queryObject.site } />;
		}
		return <JetpackConnectNotices noticeType="authorizeError" />;
	},

	getButtonText() {
		const { queryObject, isAuthorizing, authorizeSuccess, isRedirectingToWpAdmin, siteReceived, authorizeError } = this.props.jetpackConnectAuthorize;

		if ( ! this.props.isAlreadyOnSitesList &&
			queryObject.already_authorized ) {
			return this.translate( 'Return to your site' );
		}

		if ( authorizeError && authorizeError.message.indexOf( 'verify_secrets_missing' ) >= 0 ) {
			return this.translate( 'Try again' );
		}

		if ( this.props.isAlreadyOnSitesList || siteReceived ) {
			return this.translate( 'Browse Available Upgrades' );
		}

		if ( authorizeSuccess && isRedirectingToWpAdmin ) {
			return this.translate( 'Returning to your site' );
		}

		if ( authorizeSuccess ) {
			return this.translate( 'Searching Available Upgrades' );
		}

		if ( isAuthorizing ) {
			return this.translate( 'Authorizing' );
		}

		return this.translate( 'Approve' );
	},

	getUserText() {
		const { authorizeSuccess } = this.props.jetpackConnectAuthorize;
		let text = this.translate( 'Connecting as {{strong}}%(user)s{{/strong}}', {
			args: { user: this.props.user.display_name },
			components: { strong: <strong /> }
		} );

		if ( authorizeSuccess || this.props.isAlreadyOnSitesList ) {
			text = this.translate( 'Connected as {{strong}}%(user)s{{/strong}}', {
				args: { user: this.props.user.display_name },
				components: { strong: <strong /> }
			} );
		}

		return text;
	},

	isWaitingForConfirmation() {
		const { isAuthorizing, authorizeSuccess, siteReceived } = this.props.jetpackConnectAuthorize;
		return !( isAuthorizing || authorizeSuccess || siteReceived );
	},

	getRedirectionTarget() {
		const { queryObject } = this.props.jetpackConnectAuthorize;
		if ( this.props.calypsoStartedConnection ) {
			const site = this.props.jetpackConnectAuthorize.queryObject.site;
			const siteSlug = site.replace( /^https?:\/\//, '' ).replace( /\//g, '::' );
			return STATS_PAGE + siteSlug;
		}

		return queryObject.redirect_after_auth;
	},

	renderFooterLinks() {
		const { queryObject, authorizeSuccess, isAuthorizing } = this.props.jetpackConnectAuthorize;
		const loginUrl = config( 'login_url' ) + '?jetpack_calypso_login=1&redirect_to=' + encodeURIComponent( window.location.href ) + '&_wp_nonce=' + encodeURIComponent( queryObject._wp_nonce );
		let backToWpAdminLink = (
			<LoggedOutFormLinkItem icon={ true } href={ queryObject.redirect_after_auth }>
				{ this.translate( 'Cancel and go back to my site' ) } <Gridicon size={ 18 } icon="external" />
			</LoggedOutFormLinkItem>
		);

		if ( isAuthorizing ) {
			return null;
		}

		if ( authorizeSuccess ) {
			return (
				<LoggedOutFormLinks>
					{ ! this.props.calypsoStartedConnection && this.isWaitingForConfirmation() ? backToWpAdminLink : null }
					<LoggedOutFormLinkItem href={ this.getRedirectionTarget() }>
						{ this.translate( 'I\'m not interested in upgrades' ) }
					</LoggedOutFormLinkItem>
				</LoggedOutFormLinks>
			);
		}

		return(
			<LoggedOutFormLinks>
				{ ! this.props.calypsoStartedConnection && this.isWaitingForConfirmation() ? backToWpAdminLink : null }
				<LoggedOutFormLinkItem href={ loginUrl }>
					{ this.translate( 'Sign in as a different user' ) }
				</LoggedOutFormLinkItem>
				<LoggedOutFormLinkItem onClick={ this.handleSignOut }>
					{ this.translate( 'Create a new account' ) }
				</LoggedOutFormLinkItem>
			</LoggedOutFormLinks>
		);
	},

	render() {
		const { authorizeSuccess } = this.props.jetpackConnectAuthorize;
		const { site } = this.props.jetpackConnectAuthorize.queryObject;
		return (
			<div className="jetpack-connect-logged-in-form">
				{ renderFormHeader( site, authorizeSuccess ) }
				<Card>
					<Gravatar user={ this.props.user } size={ 64 } />
					<p className="jetpack-connect-logged-in-form__user-text">{ this.getUserText() }</p>
					{ this.renderNotices() }
					<button disabled={ this.isAuthorizing() } onClick={ this.handleSubmit } className="button is-primary">
						{ this.getButtonText() }
					</button>
				</Card>
				{ this.renderFooterLinks() }
			</div>
		);
	}
} );

const JetpackConnectAuthorizeForm = React.createClass( {
	displayName: 'JetpackConnectAuthorizeForm',
	mixins: [ observe( 'userModule' ) ],

	isCalypsoStartedConnection() {
		const site = this.props.jetpackConnectAuthorize.queryObject.site.replace( /.*?:\/\//g, '' );
		if ( this.props.jetpackConnectSessions && this.props.jetpackConnectSessions[ site ] ) {
			const currentTime = ( new Date() ).getTime();
			return ( currentTime - this.props.jetpackConnectSessions[ site ] < JETPACK_CONNECT_TTL );
		}

		return false;
	},

	renderForm() {
		const { userModule } = this.props;
		let user = userModule.get();
		const props = Object.assign( {}, this.props, {
			user: user
		} );
		return (
			( user )
				? <LoggedInForm { ...props } calypsoStartedConnection={ this.isCalypsoStartedConnection() } />
				: <LoggedOutForm { ...props } calypsoStartedConnection={ this.isCalypsoStartedConnection() } />
		);
	},
	render() {
		return (
			<Main className="jetpack-connect">
				<div className="jetpack-connect__authorize-form">
					{ this.renderForm() }
				</div>
			</Main>
		);
	}
} );

export default connect(
	state => {
		const site = state.jetpackConnect.jetpackConnectAuthorize && state.jetpackConnect.jetpackConnectAuthorize.queryObject
			? getSiteByUrl( state, state.jetpackConnect.jetpackConnectAuthorize.queryObject.site )
			: null;
		return {
			jetpackConnectAuthorize: state.jetpackConnect.jetpackConnectAuthorize,
			jetpackConnectSessions: state.jetpackConnect.jetpackConnectSessions,
			isAlreadyOnSitesList: !! site
		};
	},
	dispatch => bindActionCreators( { authorize, createAccount, activateManage, goBackToWpAdmin }, dispatch )
)( JetpackConnectAuthorizeForm );

