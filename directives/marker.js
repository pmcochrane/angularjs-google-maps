/**
 * @ngdoc directive
 * @name marker
 * @requires Attr2Options 
 * @requires NavigatorGeolocation
 * @description 
 *   Draw a Google map marker on a map with given options and register events  
 *   
 *   Requires:  map directive
 *
 *   Restrict To:  Element 
 *
 * @param {String} position address, 'current', or [latitude, longitude]  
 *    example:  
 *      '1600 Pennsylvania Ave, 20500  Washingtion DC',   
 *      'current position',  
 *      '[40.74, -74.18]'  
 * @param {Boolean} centered if set, map will be centered with this marker
 * @param {Expression} geo-callback if position is an address, the expression is will be performed when geo-lookup is successful. e.g., geo-callback="showStoreInfo()"
 * @param {String} &lt;MarkerOption> Any Marker options, https://developers.google.com/maps/documentation/javascript/reference?csw=1#MarkerOptions  
 * @param {String} &lt;MapEvent> Any Marker events, https://developers.google.com/maps/documentation/javascript/reference
 * @example
 * Usage: 
 *   <map MAP_ATTRIBUTES>
 *    <marker ANY_MARKER_OPTIONS ANY_MARKER_EVENTS"></MARKER>
 *   </map>
 *
 * Example: 
 *   <map center="[40.74, -74.18]">
 *    <marker position="[40.74, -74.18]" on-click="myfunc()"></div>
 *   </map>
 *
 *   <map center="the cn tower">
 *    <marker position="the cn tower" on-click="myfunc()"></div>
 *   </map>
 */
/* global google */
(function() {
  'use strict';

  var getMarker = function(options, events) {
    var marker;

    /**
     * set options
     */
    if (options.icon instanceof Object) {
      if ((""+options.icon.path).match(/^[A-Z_]+$/)) {
        options.icon.path =  google.maps.SymbolPath[options.icon.path];
      }
      for (var key in options.icon) {
        if (options.icon.hasOwnProperty(key)) {
          var arr = options.icon[key];
          if (key === "anchor" || key === "origin") {
            options.icon[key] = new google.maps.Point(arr[0], arr[1]);
          } else if (key === "size" || key === "scaledSize") {
            options.icon[key] = new google.maps.Size(arr[0], arr[1]);
          } 
        }
      }
    }
    if (!(options.position instanceof google.maps.LatLng)) {
      options.position = new google.maps.LatLng(0,0);
    } 
    if (typeof options.zIndex === "undefined" && typeof options.zIndex === "undefined" && typeof options.zindex!=="undefined") {
      //window.consoledebug("Setting marker ",options.title," to zIndex",options.zindex);
      options.zIndex = options.zindex;
    }
    marker = new google.maps.Marker(options);

    /**
     * set events
     */
    if (Object.keys(events).length > 0) {
      console.log("markerEvents", events);
    }
    for (var eventName in events) {
      if (eventName) {
        google.maps.event.addListener(marker, eventName, events[eventName]);
      }
    }

    return marker;
  };

  var marker = function(Attr2Options, $parse) {
    var parser = Attr2Options;
    var linkFunc = function(scope, element, attrs, mapController) {
      var orgAttrs = parser.orgAttributes(element);
      var filtered = parser.filter(attrs);
      var markerOptions = parser.getOptions(filtered, scope);
      var markerEvents = parser.getEvents(scope, filtered);
      
      var address;
      if (!(markerOptions.position instanceof google.maps.LatLng)) {
        address = markerOptions.position;
      }
      var marker = getMarker(markerOptions, markerEvents);
      mapController.addObject('markers', marker);

      // Create a custom label if the directive says so
      if (typeof markerOptions.customlabel !=="undefined") {
        marker.MarkerLabel = new MarkerLabel({
          'map': marker.map,
          'marker': marker,
          'text': markerOptions.customlabel.text,
          'color': markerOptions.customlabel.color || '#000000',
          'fillColor': markerOptions.customlabel.fillColor || '#ffffff',
          'fillOpacity': markerOptions.customlabel.fillOpacity || 1,
          'strokeColor': markerOptions.customlabel.strokeColor || '#ffffff',
          'strokeWeight': markerOptions.customlabel.strokeWeight || 1,
          'zIndex': marker.zIndex || 'auto',
          'backgroundColor': marker.icon.fillColor || 'transparent'
        });
        marker.MarkerLabel.bindTo('position', marker, 'position');
      }

      if (address) {
        mapController.getGeoLocation(address).then(function(latlng) {
          console.log("marker.js - marker: getGeoLocation Resolved:",address,"to",latlng.toString());
          marker.setPosition(latlng);
          mapController.zoomToIncludeMarkers();  //PMC: this should probably only be called when the map directive attribute is set as unwanted zooming may occur when adding a marker
          var geoCallback = attrs.geoCallback;
          geoCallback && $parse(geoCallback)(scope);
        });
      }

      /**
       * set observers
       */
      mapController.observeAttrSetObj(orgAttrs, attrs, marker); /* observers */
      element.bind('$destroy', function() {
        mapController.deleteObject('markers', marker);
      });
    };


    // Marker Label Overlay
    // This provides an ability to add a custom label to a marker
    var MarkerLabel = function(options) {
      var self = this;
      this.setValues(options);
      
      // Create the label container
      this.div = document.createElement('div');
      this.div.className = 'marker-label';
      var span = document.createElement('span');
      span.className = "marker-icon";
      this.div.appendChild(span);
     
      // Trigger the marker click handler if clicking on the label
      google.maps.event.addDomListener(this.div, 'click', function(e){
        (e.stopPropagation) && e.stopPropagation();
        google.maps.event.trigger(self.marker, 'click');
      });
    };

    // Create MarkerLabel Object
    MarkerLabel.prototype = new google.maps.OverlayView();

    // Marker Label onAdd
    MarkerLabel.prototype.onAdd = function() {
         /*var pane =*/ this.getPanes().overlayImage.appendChild(this.div);
         var self = this;
         this.listeners = [
              google.maps.event.addListener(this, 'position_changed', function() { self.draw(); }),
              google.maps.event.addListener(this, 'text_changed', function() { self.draw(); }),
              google.maps.event.addListener(this, 'zindex_changed', function() { self.draw(); })
         ];
    };
     
    // Marker Label onRemove
    MarkerLabel.prototype.onRemove = function() {
         this.div.parentNode.removeChild(this.div);
         for (var i = 0, I = this.listeners.length; i < I; ++i) {
              google.maps.event.removeListener(this.listeners[i]);
         }
    };
     
    // Implement draw
    MarkerLabel.prototype.draw = function() {
      var projection = this.getProjection();
      var position = projection.fromLatLngToDivPixel(this.get('position'));
      var div = this.div;
      div.style.left = position.x + 'px';
      div.style.top = position.y + 'px';
      div.style.display = 'block';
      div.style['z-index'] = this.get('zIndex'); 
      div.style['background-color'] = this.get('fillColor');
      div.style.color = this.get('color');
      div.style['border-color'] = this.get('color');
      div.style.opacity = this.get('fillOpacity'); 
      div.style.stroke = this.get('strokeColor'); 
      div.style['stroke-width'] = this.get('strokeWeight');
      this.div.innerHTML = this.get('text').toString();
      //window.consoledebug("Markerlabel: setting label",this.text,"to z-index",div.style['z-index'], this);
    };

    return {
      restrict: 'E',
      require: '^map',
      link: linkFunc
    };
  };

  marker.$inject = ['Attr2Options', '$parse'];
  angular.module('ngMap').directive('marker', marker); 

})();
