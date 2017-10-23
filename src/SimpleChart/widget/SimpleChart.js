/**
	SimpleChart
	========================

	@file      : SimpleChart.js
	@author    : Michel Weststrate
	@date      : 19-8-2010
	@copyright : Mendix
	@license   : Please contact our sales department.

	Documentation
	=============

	
	Open Issues
	===========


	File is best readable with tabwidth = 2;
*/
define([
	"dojo/_base/declare",
	"mxui/widget/_WidgetBase",
	'mxui/dom',
	"dojo/_base/lang",
	"dojo/dom-attr",
	"dojo/dom-style",
	"dojo/dom-class",
	"dojo/query",
	"dojo/dom-construct"
], function (declare, _WidgetBase, dom, lang, domAttr, domStyle, domClass, query, domConstruct) {
	"use strict";

	return declare("SimpleChart.widget.SimpleChart", [ _WidgetBase ], {
	//DECLARATION
	// addons       : [mendix.addon._Contextable],
		tabindex 	: 0,
		wwidth 		: 400,
		wheight		: 400,
		charttype	:'pie',
		caption		:'',
		polltime	: 0,
		doesnotmatter2: '',
		stilldoesntmatter: '', 
		seriesnames :'',
		seriesentity :'',
		seriesconstraint :'',
		seriescategory :'',
		seriesvalues :'',
		seriescolor :'',
		seriesclick : '',
		seriesaggregate : '',
		xastitle : '',
		yastitle : '',
		yastitle2 : '',		
		seriesyaxis : '',
		enablezoom : false,
		inverted : false,
		chartprovider: 'flot',
		extraoptions : '',
		showlegend : true,
		showxticks : true,
		showyticks : true,
		showhover  : true,
        autorefresh : false,
		dateaggregation : 'none', // or hour/day/month/year
		dateformat : '',
		yunit1 : '',
		yunit2 : '',
		uselinearscaling : true,
		constraintentity : '',
		filtername : '',
		filterattr : '',
	
	//IMPLEMENTATION
	dataobject : null,
	series : null,
	usecontext : false,
	dataobject : null,
	chart : null,
	isdate : false, //use dates as x axis?
	iscategories : false, //use categories as x axis
	rangeNode : null,
	refreshing : 0,

    splitprop : function(prop) {
		if(this[prop]) {
		return this[prop] != "" ? this[prop].split(";") : [""] ; 
		}		
	},


	fixObjProps : function(props) {
	    var args = {};
	    
	    for (var i = 0, prop; prop = props[i]; i++) {
	        var arr = this[prop];

	        for (var j = 0, obj; obj = arr[j]; j++) {
	            for (var p in obj) {
	                (args[p] || (args[p] = [])).push(obj[p]);
	            }
	        }
	    }
	    
	    for (var a in args) {
	        this[a] = args[a].join(";");
	    }
	},
	
	postCreate : function(){
		if (dojo.version.major == 5) {
				this.fixObjProps(['doesnotmatter2', 'stilldoesntmatter']);
		} 
		domStyle.set(this.domNode, { width : this.wwidth + 'px', height : this.wheight + 'px'});				
		domClass.add(this.domNode, "SimpleChartOuter");
		
		//create series object
		this.series = [];
		for(var i = 0; i < this.splitprop('seriesnames').length; i++)
			this.series[i] = {};
		for(var key in this)
			if (key != 'series' && (key.indexOf('series') == 0)) {
				var values = this.splitprop(key);
				for(var i = 0; i < values.length; i++)
					this.series[i][key.substring(6)] = values[i];
			}
			
		//create the filters object
		this.filters = [];
		for(var i = 0; i < this.splitprop('filtername').length; i++)
			this.filters[i] = {};
		for(var key in this)
			if (key != 'filters' && (key.indexOf('filter') == 0)) {
				var values = this.splitprop(key);
				for(var i = 0; i < values.length; i++)
					this.filters[i][key.substring(6)] = values[i];
			}
				
		
		if (typeof(jQuery) == "undefined")
			dojo.require("SimpleChart.widget.lib.flot.jquery_min"); //required by both implementations

		//mix chart implementations in as kind of addon, but lazy loaded..
		if (this.chartprovider == 'flot'){
			dojo.require("SimpleChart.widget.flot");
			dojo.mixin(this, SimpleChart.widget.flot);
		}
		else if (this.chartprovider == 'highcharts') {
			dojo.require("SimpleChart.widget.highcharts");
			dojo.mixin(this, SimpleChart.widget.highcharts);
		}
		
		//create the chart
		this.renderChart();
 
        //trigger data loading
        this.isresumed = true;
		this.usecontext = this.seriesconstraint.indexOf('[%CurrentObject%]') > -1;
		if (!this.usecontext) {
            this.hascontext = true;
			this.refresh(); //Note: causes charts in dataviews which do not use context to be loaded twice
        }
		else
			// this.initContext();
		
		this.start();
		this.createrangeNode();
		// this.actRendered();
	},
	
	start : function() {
		if(this.polltime > 0 && this.refreshhandle == null)
			this.refreshhandle = setInterval(dojo.hitch(this, function() {
				this.refresh();
			}), this.polltime * 1000);
	},
	
	stop : function() {
		if (this.refreshhandle != null)
			clearInterval(this.refreshhandle);
        this.refreshhandle = null;
	},
	
	suspended : function() {
		this.stop();
        this.isresumed = false;
	},
	
	resumed : function() {
		this.start();
        this.isresumed = true;
        this.refresh();
	},
	
	applyContext : function(context, callback){
		logger.debug(this.id + ".applyContext"); 
		
        if (this.dataobject && this.autorefresh)
			mx.data.unsubscribe(this, this.dataobject);
        
        if (context && context.getTrackID() != "" && this.usecontext) {
			this.dataobject = context.getTrackID();
			this.hascontext = true;
            this.refresh();
            
            if (this.autorefresh) 
				mx.data.subscribe(this, this.dataobject);
		}
		else
			logger.warn(this.id + ".applyContext received empty context");
		callback && callback();
	},
    
    objectUpdate : function(newobject, callback) {
        this.refresh();
        callback && callback();
    },
    
	refresh : function() {
        if (!this.isresumed || !this.hascontext)
            return;
          
		if (this.refreshing > 0) {
			console.log(this.id + " is already busy fetching new data");
			return;
		}
        
        if (this.waitingForVisible)
            return;
        
        this.waitingForVisible = true;
            
        var loadfunc = dojo.hitch(this, function() {
            for(var i = 0; i < this.series.length; i++)
                this.loadSerie(i);
            this.waitingForVisible = false;
        });
        
        if (dojo.marginBox(this.domNode).h == 0) { //postpone update if hidden
            mendix.lang.runOrDelay( 
                loadfunc, 
                dojo.hitch(this, function() {
                    return dojo.marginBox(this.domNode).h > 0;
                })
            );
        }
        else
            loadfunc();
	},
	
	loadSerie : function(index) {
		if (this.usecontext && !this.dataobject)
			return; //no context yet, abort
		this.refreshing++;
		var serie = this.series[index];

		if (serie.schema == null) {
			serie.schema = {
				attributes : [],
                references : {},
				sort    : [[serie.category, 'asc']]
			};
            
            var cat = serie.category.split("/");
            if (cat.length == 1)
                serie.schema.attributes.push(serie.category);
            else {
                serie.schema.references[cat[0]] = {
                  attributes : [cat[2]]
                };
                serie.constraint += "[" + cat[0] + "/" + cat[1] + "]";
            }
            
            if (serie.values) {
              var path = serie.values.split("/");
              if (path.length == 1)
                  serie.schema.attributes.push(serie.values);
              else 
                  serie.schema.references[path[0]] = {
                      attributes : [path[2]]
                  };
            }
		}
		
		//execute the get. 
		mx.data.get({
				xpath : "//" + serie.entity + this.getActiveConstraint(index) + serie.constraint.replace(/\[\%CurrentObject\%\]/gi, this.dataobject),
				filter : serie.schema, //TODO: should be schema : serie.schema, but only in 2.5.1 and upward, 
				callback : dojo.hitch(this, this.retrieveData, index),
				error: dojo.hitch(this, function(err) {
					console.error("Unable to retrieve data for xpath '" + xpath + "': " + err, err);
				})
		});
	},
    
    getMetaDataPropertyOwner : function (baseObject, attribute) {
        if (attribute.length == 1)
            return baseObject.metaData;
        var sub = baseObject.getChild(attribute[0]);
        if (sub == null || sub._guid == 0)
            throw "Reference to category attribute cannot be empty!";
        return sub.metaData;
    },
    
	retrieveData : function(seriesindex, objects) {
		try { try {
			var serie = this.series[seriesindex];
			serie.data = [];
            valueattr = serie.values ? serie.values.split("/") : null;
            labelattr = serie.category.split("/");
			
            var rawdata = []; //[[xvalue, yvalue, originalobject]]
            
            //aggregate all data to the rawdata object
            var len = objects.length;
			for(var i = 0; i < len; i++) {
				//check the data category type
				if (i == 0 && seriesindex == 0) {
					this.isdate = this.getMetaDataPropertyOwner(objects[i], labelattr).isDate(labelattr[labelattr.length -1]);
					this.iscategories = !this.isdate && !this.getMetaDataPropertyOwner(objects[i], labelattr).isNumber(labelattr[labelattr.length -1]);
				}

                //get the x value
				var x;
                if (labelattr.length == 1)
                    x = this.dateRound(objects[i].getAttribute(serie.category));
                else {
                    var sub = objects[i].getChild(labelattr[0]);
                    if (sub == null || sub._guid == 0)
                        throw "Reference to category attribute cannot be empty!";
                    x = this.dateRound(sub.getAttribute(labelattr[2])); 
                }
                
                //get the y value
                if (!valueattr) //not defined
                  rawdata.push([x, 1, objects[i]]);
                else if (valueattr.length == 1) //attr
                  rawdata.push([x, parseFloat(objects[i].getAttribute(valueattr[0])), objects[i]]);
                else { //reference
                  var subs = objects[i].getChildren(valueattr[0]);
                  for(var j = 0; j < subs.length; j++)
                    rawdata.push([x, parseFloat(subs[j].getAttribute(valueattr[2])), objects[i]]);
                }
			}
            
            //loop raw data to aggregate
            var currenty = [];
            len = rawdata.length;
            for(var i = 0; i < len; i++) {
                currentx = rawdata[i][0];
                currenty.push(rawdata[i][1]);
                
                if (i < len -1 && currentx === rawdata[i + 1][0] && serie.aggregate != 'none')
                    continue;
                else {
                    //calculate the label, which, can be a referred attr...
                    var labelx = "";
                    if (!this.iscategories)
                      labelx = this.getFormattedXValue(currentx);
                    else if (labelattr.length == 1)
                      labelx = mendix.html.renderValue(rawdata[i][2], labelattr[0]);
                    else {
                      var sub = rawdata[i][2].getChild(labelattr[0]);
                      if (sub == null || sub._guid == 0)
                        throw "Reference to category attribute cannot be empty!";
                      labelx = mendix.html.renderValue(sub, labelattr[2]);
                    }
                  
                    var newitem = {
                        index : serie.data.length,
                        origx : this.iscategories ? currentx : parseFloat(currentx),
                        labelx : labelx,
                        guid : rawdata[i][2].getGUID(),
                        y : this.aggregate(serie.aggregate, currenty)
                    };

                    newitem.labely = dojo.trim(this.getFormattedYValue(serie, newitem.y));
                    if (this.charttype == 'pie') //#ticket 9446, show amounts if pie
                        newitem.labelx += " ("  + newitem.labely + ")";
                    
                    serie.data.push(newitem);
                    currenty = [];
				}
			}
            
            //sort
            this.sortdata(seriesindex);

			if (dojo.marginBox(this.domNode).h > 0) //bugfix: do not draw if the element is hidden
				this.renderSerie(seriesindex);
		}
		catch(e) {
			console.error(this.id +" Error while rendering chart data " + e, e);
		} } finally {
			this.refreshing--;
		}
	},
	
    sortdata : function(seriesindex) {
        var serie = this.series[seriesindex];
        if (this.iscategories) {
          var labelattr = serie.category.split("/");
          var attrname = labelattr[labelattr.length -1];
          var meta = mx.metadata.getMetaEntity({ 
            className: labelattr.length == 1 ? serie.entity : labelattr[1] 
          });
          
          if (meta.getAttributeType(attrname) == 'Enum') {
            var enums = meta.getEnumMap(attrname);

            //put them in a maps
            var targetmap = {};
            dojo.forEach(serie.data, function(item) {
              targetmap[item.origx] = item;
            });
            
            //create new list
            var result = [];
            var i = 0; 
            dojo.forEach(enums, function(val) {
              if (targetmap[val.key]) {
                result.push(targetmap[val.key]);
                targetmap[val.key].index = i; //update index!
                i += 1;
              }
            });
            
            serie.data = result;
          }
        }        
    },
    
	aggregate : function(aggregate, vals) {
		var result = 0;
		switch(aggregate) {
			case 'sum' :
            case 'logsum':
				dojo.forEach(vals, function(value) {
					result += value;
				});
                if (aggregate == 'logsum')
                  result = Math.log(result);
				break;
			case 'count':
				dojo.forEach(vals, function(value) {
					result += 1;
				});				
				break;
			case 'avg':
				dojo.forEach(vals, function(value) {
					result += value;
				});				
				break;
			case 'min':
				result = Number.MAX_VALUE;
				dojo.forEach(vals, function(value) {
					if(value < result)
						result = value;
				});				
				break;
			case 'max':
				result = Number.MIN_VALUE;
				dojo.forEach(vals, function(value) {
					if(value > result)
						result = value;
				});								
				break;
			case 'none':
			case 'first':
				result = vals[0];
				break;
   case 'last':
    result = vals.length > 0 ? vals[vals.length-1] : 0;
    break;
			default:
				this.showError("Unimplemented aggregate: " + aggregate);
		}
		if (aggregate == "avg")
			return vals.length > 0 ? result / vals.length : 0;
		return result;
	},
	
	clickCallback : function(serie, itemindex, clientX, clientY) {
		if (this.series[ serie ].click) mx.data.action({
			params: {
				actionname: this.series[ serie ].click,
				applyto: 'selection',
				guids: [ this.series[ serie ].data[ itemindex ].guid ]
			},
			error: function () {
				logger.error(this.id + "error: XAS error executing microflow");
			}
		});		
	},
	
	uninitialize : function(){
		this.stop();
		this.uninitializeChart();
	},
	
	showError : function (msg) {
		dojo.empty(this.domNode);
		dojo.html.set(this.domNode, "SimpleChart error: " + msg);
		console.error("SimpleChart error: " + msg);
		return null;
	},
	
	showWarning : function (msg) {
		console.warn(msg);
	},
	
		//////// SECTION LABEL FORMATTING
	
	/** maps a domain X value to a label */
	getFormattedXValue : function(value) {
		if (!this.series[0].data)
			return "";
		if (this.isdate) {
			var date = new Date(value);
			return dojo.date.locale.format(date, this.getDateTimeFormat());
		}
		if (this.iscategories) { //if categories, than value equals index
			if (value < this.series[0].data.length)
				return this.series[0].data[value].labelx;
			return "";
		}
		if (!this.uselinearscaling)
			return dojo.number.round(this.series[0].data[value].origx,2);
		return dojo.number.round(value, 2);
	},
	
	/** maps a plot X value to a label */
	getXLabelForValue : function(value) {
		if (!this.series[0].data || this.series[0].data.length == 0)
			return "";
		if (this.iscategories) {
			if (value >= 0 && value < this.series[0].data.length)
				return this.series[0].data[value].labelx; //or return categorie?
			return "";
		}
		else if (this.uselinearscaling && !this.iscategories)
			return this.getFormattedXValue(value);
		else if (value < this.series[0].data.length) {
            
            return this.series[0].data[
              !isNaN(value-0) ?
              Math.round(value) :
              value
            ].labelx; //value is the index for non linear data!
            //round is required for flot to map to the closest concrete point in the data. Its a bit annoying though since the label does not match exactly. Should be a better way
        }
		return "";
	},

	getFormattedYValue : function(serie, value) {
		return ("" + dojo.number.round(value, 2)) + " " +(serie.yaxis == "true" ? this.yunit1 : this.yunit2); 
	},

	
	getDateTimeFormat : function() {
		switch(this.dateformat) {
			case 'fulldate': return { selector : 'date', datePattern : "y-MM-dd"};
			case 'day': return 			{ selector : 'date', datePattern : "EEE"};
			case 'month': return 		{ selector : 'date', datePattern : "MMM"};
			case 'monthday': return { selector : 'date', datePattern : "dd MMM"};
			case 'year': return 		{ selector : 'date', datePattern : "y"};
			case 'yearmonth': return{ selector : 'date', datePattern : "MMM y"};
			case 'time': return 		{ selector : 'time', timePattern : "HH:mm"};
			case 'datetime': return { datePattern : "y-MM-dd", timePattern : "HH:mm"};
			default: this.showError("Unknown dateformat: " + this.dateformat);
		}
		return null;
	},
	
	dateRound : function(x) {
		if (!this.isdate || this.dateaggregation == 'none')
			return x;
		var d = new Date(x);
		switch(this.dateaggregation) {
			case 'year':
				d.setMonth(0);
			case 'month':
				d.setDate(1);
			case 'day':
				d.setHours(0)
			case 'hour':
				d.setMinutes(0);
				d.setSeconds(0);
				d.setMilliseconds(0);
				break;
		}
		return d.getTime();
	},
	
	//////// SECTION FILTER IMPLEMENTATION
	
	getActiveConstraint : function(index) {
		if (this.series[index].entity != this.constraintentity)
			return "";
		var res = "";
		for(var i = 0; i < this.filters.length; i++) {
			var filter = this.filters[i];
			if (filter.value && filter.value != {} && filter.value != '') {
				if (filter.attr.indexOf("/") > -1) {
                    for (key in filter.value)
                        if (filter.value[key] == true) {
                            var attr = filter.attr.split("/");
                            res += "[" + filter.attr + " = '" + this.escapeQuotes(key) + "']";
                            break;
                        }
                  continue;
                }   
                switch(filter.type) {
					case "Integer":
					case "DateTime":
						if (filter.value.start)
							res += "[" + filter.attr + ">="+ filter.value.start + "]";
						if (filter.value.end)
							res += "[" + filter.attr + "<="+ filter.value.end + "]";
						break;
					case "String":
						if (dojo.isString(filter.value))
							res += "[contains(" + filter.attr + ",'" + this.escapeQuotes(filter.value) + "')]";
						break;
					case "Boolean":
					case "Enum":
						var enums = "";
						var all = true; //if all are checked, include null values
						for(key in filter.value) {
							if (filter.value[key] == true)
								enums += "or " + filter.attr + "= " + (filter.type=="Enum" ? "'" + key + "'" : key) + " ";
							else
								all = false;
						}
						if (enums!= "" && !all)
							res += "[" + enums.substring(2) + "]";
						break;
					default:
						return this.showError("Type not supported in filters: " + filter.type);
				}
			}
		}
		return res;
	},
	
	clearConstraint : function() {
		for(var i = 0; i < this.filters.length; i++) {
			var filter = this.filters[i];
			switch(filter.type) {
				case "Boolean":
				case "Enum":
					for(key in filter.value) 
						filter.value[key] = true;
					break;
				default:
					filter.value = {};
					break;
			}
		}
		
		for(var i = 0; i < this.inputs.length; i++) {
			var input = this.inputs[i];
			if (input.declaredClass == "dijit.form.CheckBox")
				input.setValue(true);
			else if (input.nodeName == "SELECT")
				input.value = '';
			else
				input.setValue(null);
		}
		
		this.refresh();
	},
	
	createrangeNode : function() {
		if (this.constraintentity == "")
			return;
		
		var open = dom.create("span", {'class': "SimpleChartFilterOpen"}, "(filter)");
		this.connect(open, "onclick", function() { dojo.style(this.rangeNode, {display : 'block'}); });
		dojo.place(open, this.domNode);		
		
		var n = this.rangeNode = dom.create("div", { 'class' : 'SimpleChartRangeNode' });
		dojo.place(n, this.domNode);
		
		//retrieve the type and then construct the inputs
		mx.meta.getEntity({ 
			className :this.constraintentity,
			callback : dojo.hitch(this, this.addFilterInputs)
		});
	},
	
	inputs : null,
	
	addFilterInputs : function(meta) {
		try {
			this.inputs = [];
			dojo.require("dijit.form.DateTextBox");
			dojo.require("dijit.form.NumberTextBox");
			dojo.require("dijit.form.TextBox");
			dojo.require("dijit.form.CheckBox");
			dojo.require("dijit.form.Button");		
			
			var close = dom.create("span", {'class': "SimpleChartFilterClose"}, "x");
			this.connect(close, "onclick", this.closeFilterBox);
			dojo.place(close, this.rangeNode);
				
			for(var i = 0; i < this.filters.length; i++) {
				var filter = this.filters[i];

				filter.value = {};
				var catNode = mendix.dom.div({'class': "SimpleChartFilterCat"});
				dojo.place(catNode, this.rangeNode);

                if (filter.attr.indexOf("/") > -1) {
                  if (this.usecontext)
                    this.connect(this, 'applyContext', dojo.hitch(this, this.addReferencedFilterAttr, filter, catNode));//wait for context
                  else
                    this.addReferencedFilterAttr(filter, catNode)
                  continue;
                }

                dojo.place(mendix.dom.span({'class': "SimpleChartFilterLabel"}, filter.name),catNode);				
				filter.type = meta.getAttributeClass(filter.attr);
                
				if (meta.isDate(filter.attr)) 
						this.createDateRangeSelector(catNode, filter);
				
				else if (meta.isNumber(filter.attr)) 
					this.createNumberRangeSelector(catNode, filter);	

				else if (meta.isEnum(filter.attr)) {
					var enums = meta.getEnumMap(filter.attr);
					if (enums.length < 5) {
						for(var j = 0; j < enums.length; j++)
							this.createCheckbox(catNode, filter, enums[j].key, enums[j].caption);
					} else {
						this.createDropdown(catNode, filter, enums);
					}
				}
				else if (meta.isBoolean(filter.attr)) {
					this.createCheckbox(catNode, filter, "true()",  "True");
					this.createCheckbox(catNode, filter, "false()", "False");
				}
				else if (filter.type == "String") {
					var widget = new dijit.form.TextBox();
					widget.onChange = dojo.hitch(this, function(filter, value){
						filter.value = value;
					}, filter);
					dojo.place(widget.domNode, catNode);
					this.inputs.push(widget);
				}				
				else
					this.showError("Unimplemented filter attribute type: " + filter.type);
			}

			for(var i = 0; i < this.inputs.length; i++)
			domClass.add(this.inputs[i].domNode, "SimpleChartFilterInput");

			var update = new dijit.form.Button({'class': "SimpleChartFilterUpdate", label : "update", onClick : dojo.hitch(this, function() {
				this.refresh();
				this.closeFilterBox();
			})});
			dojo.place(update.domNode, this.rangeNode);
			var clear = new dijit.form.Button({'class': "SimpleChartFilterClear", label : "clear", onClick : dojo.hitch(this, this.clearConstraint)});
			dojo.place(clear.domNode, this.rangeNode);
		}
		catch(e) {
			this.showError("Unable to create filter inputs: " + e);
		}
	},
	
    addReferencedFilterAttr : function(filter, catNode) {
        if (!this.dataobject && this.usecontext)
            return; //we are waiting for context...
            
        dojo.empty(catNode);
        
        dojo.place(dom.create("span", {'class': "SimpleChartFilterLabel"}, filter.name),catNode);
        
        var attrparts = filter.attr.split("/");
        var ref = attrparts[0];
        var entity = attrparts[1];
        var attr = attrparts[2];
        
        var dataconstraint = "";
        
        for(var i = 0; i< this.series.length; i++)
          if (this.series[i].entity == this.constraintentity)
            dataconstraint += this.series[i].constraint; //apply constraint of the data to the selectable items.
        
        mx.data.get({
            xpath : ("//" + entity + "[" + ref + "/" + this.constraintentity +  dataconstraint + "]").replace(/\[\%CurrentObject\%\]/gi, this.dataobject),
            filter : {
			  attributes : [ attr ],
              references : {},
			  sort    : [[attr, 'asc']]
			},
            callback : dojo.hitch(this, this.retrieveFilterData, filter, catNode),
            error : dojo.hitch(this, this.showError)
        });
    },
    
    retrieveFilterData : function(filter, catNode, objects) {
        var attr = filter.attr.split("/")[2];
        var enums = dojo.map(objects, function(item) {
          var val = item.getAttribute(attr);
          return { key : val, caption : val }
        }, this);
        this.createDropdown(catNode, filter, enums);
    },
    
	closeFilterBox : function() {
		dojo.style(this.rangeNode, {display : 'none'});		
	},
	
	createCheckbox : function(catNode, filter, value, caption) {
		filter.value[value] = true;
		var checkBox = new dijit.form.CheckBox({value: value, checked: true});
		dojo.place(checkBox.domNode, catNode);
		dojo.place(mendix.dom.label({"class" : "SimpleChartFilterCheckboxLabel"}, caption), catNode);
		checkBox.onChange = dojo.hitch(this, function(filter, value, checked) {
			filter.value[value] = checked;
		}, filter, value);
		this.inputs.push(checkBox);
	},
	
	createDropdown : function(catNode, filter, valueArr) {
		var selectNode = mendix.dom.select();
		var optionNode = mendix.dom.option({ value : ''}, '');
		selectNode.appendChild(optionNode);
		for (var i = 0; i < valueArr.length; i++) 
            if (!filter.value[valueArr[i].key]) { //avoid items to appear twice
                var optionNode = mendix.dom.option({ value : valueArr[i].key}, valueArr[i].caption);
                filter.value[valueArr[i].key] = false;
                selectNode.appendChild(optionNode);
            }
            
		dojo.place(selectNode, catNode);
		this.connect(selectNode, "onchange", dojo.hitch(selectNode, function (filter, e) {
			for (var key in filter.value)
				filter.value[key] = key == this.value;
		}, filter));
		selectNode['domNode'] = selectNode;
		this.inputs.push(selectNode);
	},
	
	createDateRangeSelector : function(catNode, filter) {
		//create two date inputs
				
		var widget = new dijit.form.DateTextBox({});
		widget.onChange = dojo.hitch(this, function(filter, value) {
			filter.value.start = value == null ? null : value.getTime();
		}, filter);
		dojo.place(widget.domNode, catNode);
		this.inputs.push(widget);
		
		widget = new dijit.form.DateTextBox({});
		widget.onChange = dojo.hitch(this, function(filter, value) {
			filter.value.end = value == null ? null : value.getTime();
		}, filter);
		dojo.place(widget.domNode, catNode);
		this.inputs.push(widget);
	},
	
	createNumberRangeSelector : function(catNode, filter) {
		var widget = new dijit.form.NumberTextBox();
		widget.onChange = dojo.hitch(this, function(filter, value){
			filter.value.start = value;
		}, filter);
		dojo.place(widget.domNode, catNode);
		this.inputs.push(widget);
		
		widget = new dijit.form.NumberTextBox();
		widget.onChange = dojo.hitch(this, function(filter, value){
			filter.value.end = value;
		}, filter);
		dojo.place(widget.domNode, catNode);
		this.inputs.push(widget);
	},
    
    escapeQuotes : function(value) { //MWE: fix the fact that mxcompat is not correct for escapeQuotes in 3.0.0.
        if ((typeof (mxui) != "undefined") && mxui.html)
            return mxui.html.escapeQuotes(value);
        else
            return mx.parser.escapeQuotesInString(value);
    },
    
    objectmix : function(base, toadd) {
      //MWE: because console.dir(dojo.mixin({ a : { b : 3 }}, { a : { c : 5 }})); -> { a : { c : 5 }}, but i want to keep b
      if (toadd) {
        /*console.log("in");
        console.dir(base);
        console.log("add");
        console.dir(toadd);*/
        for(var key in toadd) {
            if ((key in base) &&
                ((dojo.isArray(toadd[key]) != dojo.isArray(base[key])) || 
                 (dojo.isObject(toadd[key]) != dojo.isObject(base[key]))))
                throw "Cannot mix object properties, property '" + key + "' has different type in source and destination object";
                
           //mix array
          if (key in base && dojo.isArray(toadd[key])) { //base is checked in the check above
            var src = toadd[key];
            var target = base[key];
            for(var i = 0; i < src.length; i++) {
                if (i < target.length) {
                    if (dojo.isObject(src[i]) && dojo.isObject(target[i]))
                        this.objectmix(target[i], src[i]);
                    else
                        target[i] = src[i];
                }
                else 
                    target.push(src[i]);
            }     
          }
          //mix object
          else if (key in base && dojo.isObject(toadd[key])) //base is checked in the check above
            this.objectmix(base[key], toadd[key]);
          //mix primitive
          else
            base[key] = toadd[key];
        }
      }
      /*console.log("out");
      console.dir(base);*/
    }
		});
	});

require([ "SimpleChart/widget/SimpleChart" ]);
