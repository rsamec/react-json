'use strict';

var React = require('react'),
	objectAssign = require('object-assign'),
	Validation = require('./validation'),
	TypeField = require('./TypeField')

;

var clearObjProps = function (obj) {
	for(var k in obj) {
		if(typeof obj[k] == "object"
			&& obj[k] !== null
			&& !(obj[k] instanceof Array)
			&& !(obj[k] instanceof String)
			&& !(obj[k] instanceof Number)) {

			clearObjProps(obj[k]);
			continue;
		}

		switch(typeof obj[k]) {
			case 'undefined':
			case 'boolean':
			case 'string':
			case 'number':
				obj[k] = undefined;
				break;
			default:
				obj[k] = [];
		}
	}
	return  obj;
}
/**
 * Field component that represent each Array element or Object field.
 * @param  {string} name The key of the attribute in the parent.
 * @param  {Mixed} value The value of the attribute.
 * @param {Mixed} original The value of the attibute in the original json to highlight the changes.
 * @param {FreezerNode} parent The parent node to notify attribute updates.
 */
var Field = React.createClass({

	getInitialState: function(){
		return {error: false};
	},
	getDefaultProps: function(){
		return {
			definition: {}
		};
	},
	render: function(){
		var definition = this.props.definition || {},
				binding = this.props.binding,
			className = 'jsonField',
			type = definition.type || TypeField.prototype.guessType( this.props.value ),
			id = this.props.id + '_' + this.props.name,
			error = '',
			typeField
		;



		if( type == 'react' )
			return this.renderReactField( definition );

		if (this.useBinding() && binding !== undefined) {
			//render Object with binding
			typeField = [this.renderBindingField(id)];
		}
		else{
			typeField = [this.renderTypeField(type, id)];
		}
		className += ' ' + type + 'Field';

		if( this.state.error ){
			className += ' jsonError';
			if( this.state.error !== true )
				error = React.DOM.span({ key:'e', className: 'jsonErrorMsg' }, this.state.error );
		}

		var jsonName = [ React.DOM.label({ key: 's1', htmlFor: id }, (definition.title || this.props.name) + ':' ) ];

		if( this.props.fixed ){
			// If the field cannot be removed, add a placeholder to maintain the design
			jsonName.unshift( React.DOM.span({ key:'f', className: 'jsonFixed' }) );
		}
		else{
			jsonName.unshift( React.DOM.a({ key:'a', href: '#', className: 'jsonRemove', onClick: this.handleRemove}, 'x') );
		}

		if(this.useBinding() && binding === undefined){
			typeField.unshift( React.DOM.a({ key:'b', className: 'jsonBind', onClick: this.handleAddBinding}, '=') );
		}

		if(this.props.value === undefined && !(this.useBinding() && binding !== undefined) ){
			// If the field cannot be removed, add a placeholder to maintain the design
			typeField.unshift( React.DOM.span({ key:'f', className: 'jsonFixed' }) );
		}
		else{
			typeField.unshift( React.DOM.a({ key:'r', className: 'jsonReset', onClick: this.handleReset}, 'x') );
		}



		return React.DOM.div({className: className}, [
			React.DOM.span( {className: 'jsonName', key: 'n'}, jsonName ),
			React.DOM.span( {className: 'jsonValue', key: 'v'}, typeField ),
			error
		]);
	},
    useBinding:function(){
		return this.props.parentSettings && this.props.parentSettings.useBinding;
	},
	renderTypeField: function( type, id ){
		var definition = this.props.definition,
			settings = objectAssign( {}, definition.settings || {} ),
			component
		;

		if( definition.fields )
			settings.fields = definition.fields;

		component = React.createElement( TypeField, {
			type: type,
			value: this.props.value,
			binding:this.props.binding,
			settings: settings,
			onUpdated: this.onUpdated,
			ref: 'typeField',
			id: id,
			parentSettings: this.props.parentSettings
		});
		return component;
	},
	renderBindingField: function(id) {

		return React.createElement(TypeField, {
			type: 'object',
			value: this.props.binding,
			settings: {
				fields: {
					path:{type:'string'},
					mode: {
						type: 'select', settings: {
							editing: false,
							options: ['OneWay', 'TwoWay','OneTime'].map(function (key, value) {
								return {value: key, label: key};
							})
						}
					},
					converter: {
						type: 'codeEditor'
					},
					converterArgs:{type:'string'}
				}
			},
			onUpdated: this.onBindingUpdated,
			ref: 'typeField',
			id: id,
			parentSettings: this.props.parentSettings
		});
	},

	renderReactField: function( definition ){
		return React.DOM.div( { className: 'jsonField reactField' }, definition.output );
	},

	handleRemove: function( e ){
		this.props.onDeleted( this.props.name );
	},
	handleReset: function( e ){
		var definition = this.props.definition || {},type = definition.type || TypeField.prototype.guessType( this.props.value );
		if (type === 'object') {
			this.onUpdated(clearObjProps(this.props.value.toJS()));
		}else{
			this.onUpdated(undefined);
		}
	},
	handleAddBinding:function(e){
		var defaultValues = {
			path: undefined,
			converter: undefined,
			converterArgs:undefined,
			mode: 'OneWay'
		};
		this.onBindingUpdated(defaultValues);

	},

	shouldComponentUpdate: function( nextProps, nextState ){
		return nextProps.value != this.props.value ||  nextProps.binding != this.props.binding  || nextState.error != this.state.error;
	},

	onUpdated: function( value ) {
		if (this.useBinding() && this.props.binding !== undefined){
			this.onBindingUpdated(value);
			return;
		}
		var definition = this.props.definition;
		if (this.props.value !== value) {
			this.props.onUpdated(this.props.name, value);
			if (definition.onChange)
				definition.onChange(value, this.props.value);
		}

	},
	onBindingUpdated: function( value ) {
		this.props.onBindingUpdated(this.props.name, value);
	},

	getValidationErrors: function( jsonValue ){
		var childErrors = [],
			validates = this.props.definition.validates,
			name = this.props.name,
			field = this.refs.typeField
		;

		if( !field )
			return [];

		if( field.fieldType == 'object' ){
			childErrors = field.getValidationErrors( jsonValue );
			childErrors.forEach( function( error ){
				if( !error.path )
					error.path = name;
				else
					error.path = name + '.' + error.path;
			});

			if( childErrors.length )
				this.setState( {error: true} );
		}

		if( !validates )
			return childErrors;


		var error = Validation.getValidationError( this.props.value, jsonValue, validates ),
			message
		;

		if( error ){
			message = this.props.definition.errorMessage;
			if( !message )
				message = ( this.props.definition.label || this.props.name ) + ' value is not valid.';

			error.path = name;
			error.message = message;
			this.setState( {error: message} );
			childErrors = childErrors.concat( [error] );
		}
		else if( this.state.error ){
			this.setState( {error: false} );
		}

		return childErrors;
	}

});

module.exports = Field;
