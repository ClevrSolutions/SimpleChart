// dojo.provide("SimpleChart.widget.highcharts");
// dojo.require("SimpleChart.widget.lib.highcharts.highcharts_src"); //or _src		

require(["dojo/_base/lang"], function(lang){
	lang.setObject("SimpleChart.widget.highcharts", {
	//free up any resources used by the chart
	uninitializeChart : function() {
		this.chart && this.chart.destroy();
	},
	
	//mapping between the SimpleChart charttype and the HighCharts charttype
	getChartTypeName : function(value) {
		switch(value) {
			case 'pie': return 'pie';
			case 'bar': return 'column';
			case 'line': return 'line';
			case 'curve': return 'spline';
			case 'stack': return 'area';				
		}
		return 'line';
	},

	//triggered if an serie needs to be (re) rendered as a result of receiving (new) data. 
	renderSerie : function(index) {
		try {
			var serie = this.series[index];
			//first serie, set the categories if names are used
			if (index == 0 && this.iscategories) {
				var categories = [];
				for(var i = 0; i < serie.data.length; i++)
					categories.push(serie.data[i].name);
				this.chart.xAxis[0].setCategories(categories, false);
			}
		
			var data = this.getSeriesData(index);
			//if the serie was already created, replace its data
			if (this.chart.series[index] != undefined)
				this.chart.series[index].setData(data.data, false);
			
			//otherwise add a new serie
			else
				this.chart.addSeries(data, false);
			
			this.chart.redraw();
		}
		catch(e) {
			console.error(this.id + " Error while rendering serie " + index + ": " + e,e);
		}
	},

	//helper function to constructie a series data array for highcharts
	getSeriesData : function(index) {
		var self = this;
		var size = this.wwidth / this.series.length; //size if multiple pie's are used
		var serie = this.series[index];
			
		//add a click event for each point
		for(var j = 0; j < serie.data.length; j++) 
				(function() { 
						var cur = index; //trap the current iteration in the scope 
						var itemindex = j; 
						serie.data[j]['events'] = { click : function(arg1, arg2, arg3) { 
							self.clickCallback(cur, itemindex, this.pageX, this.pageY); 
						}};
						serie.data[j].x = !self.iscategories && self.uselinearscaling ? serie.data[j].origx : serie.data[j].index;
				})();			

		//set serie properties
		var data = {
			name : serie.names,
			data : serie.data,
			color: serie.color,				
			type : this.getChartTypeName(this.charttype),
			showInLegend: this.charttype == 'pie' ? false : true,
			yAxis : serie.yaxis == "true" ? 0 : 1
		};
				
		//make positions for pie
		if (this.series.length > 1 && this.charttype == 'pie') {
			data['center'] = [size * index, Math.round(this.wheight / 2) - 20];
			data['size'] =  Math.round(this.wwidth / this.series.length) - 20;
		}
		return data;
	},
	
	//create a new chart, set all the default options
	renderChart : function() {
		try {
			var yaxis = [{
				title: {
					text: this.yastitle
				},
				labels : {
					formatter : function() {
						return self.showyticks ? this.value + " " + self.yunit1 : "";
					}
				},
				tickLength : this.showyticks ? 5 : 0
			}];
			
			//create seperate y axises
			for(var i = 1; i < this.series.length; i++)	{
				var serie = this.series[i];
				if (serie.yaxis != "true") { 
					if (yaxis.length > 1)
						contiue;
					else {
						yaxis[1] = {
							title : { text : this.yastitle2 },
							opposite : true,
							offset : 0,
							tickLength : this.showyticks ? 5 : 0,
							labels : {
								formatter : function() {
									return self.showyticks ? this.value + " " + self.yunit2 : "";
								}
							}
						}
					}
				}
			}
	
			var self = this;
			var options = {
				credits : {
					enabled : false
				},
				chart: {
					renderTo: this.domNode,
					zoomType : this.enablezoom ? 'x' : null,
					inverted : this.inverted,
					width : this.width,
					height : this.height
				},
				title: {
					text: this.caption
				},
				xAxis: {
					title : {
						text: this.xastitle
					},
					tickLength : this.showxticks ? 5 : 0,
					labels : {
						formatter : function() {
							if (!self.showxticks)
								return "";
							return self.getXLabelForValue(this.value);
						}
					}
				},
				yAxis: yaxis,
				tooltip: {
					enabled : this.showhover,
					formatter: function() {
                        return '<b>'+ this.series.name + '</b><br/>' + this.point.labelx +': '+
                            (self.charttype == 'pie' ? dojo.number.round(this.percentage, 2) + '%' : this.point.labely);
                    }
				},
				plotOptions: {
					series: {
						stacking: this.charttype == 'stack' ? 'normal' : null
					},
					pie: {
						dataLabels: {
							enabled: true,
							formatter: function() {
								if (this.percentage > 5)
									return this.point.labelx + "<br/>(" + dojo.number.round(this.point.percentage,0) + "%)";
								return "";
							},
							color: 'white'
						}
					}
				},
				legend: {
					enabled : this.showlegend,
					borderWidth: this.charttype == 'pie' ? 0 : 1
				}
			};
			
			if (this.extraoptions != '')
				this.objectmix(options, dojo.fromJson(this.extraoptions));
			this.chart = new Highcharts.Chart(options);
		} catch (e) {
			console.error("Error while building chart: " + e);
			if (e.name == "SyntaxError")
				this.showError("Please check whether the extra chart options are valid JSON");
		}
		return null;
		}
	});
});
require([ "SimpleChart/widget/lib/highcharts/highcharts_src" ]);
