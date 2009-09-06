/*  Magnifier class.
 *  Produces a "magnifier bar" where the element under the mouse
 *  is magnified as you scroll around the bar.  Very Cute.
 *
 *  Requires (but doesn't check for) prototype 1.6. (http://prototypejs.org/)
 *  May work with earlier or later versions, up to you to test. :)
 *
 *  Copyright 2006-2007 Sam Graham.  http://www.illusori.co.uk/
 *  This work is licensed under a
 *  Creative Commons Attribution-Share Alike 2.0 UK: England & Wales License
 *  http://creativecommons.org/licenses/by-sa/2.0/uk/
 *  In human-readble terms: you're free to copy, distribute and modify
 *  providing you maintain attribution and licence.
 *
 *  Use at your own risk, no fitness for purpose implied, etc, etc.
 */

/*  Thanks to PPK of the wonderful www.quirksmode.org for this function.  */
function findPos( obj )
{
    var curleft = curtop = 0;
    if( obj.offsetParent )
    {
        curleft = obj.offsetLeft;
        curtop  = obj.offsetTop;
        while( obj = obj.offsetParent )
        {
            curleft += obj.offsetLeft;
            curtop  += obj.offsetTop;
        }
    }
    return( [ curleft, curtop ] );
}

Magnifier = Class.create();

Magnifier.prototype = {

    Version: '1.0.0.0',

    defaults: {
        orientation:    'horizontal',
        scalingmax:     300,
        scalingdropoff: 2
        },

    getConfigValue: function( setting, isNum )
        {
            var value;

            /*  Grab the config from the sgmagnifier namespace attributes if
             *  they exist, otherwise use our defaults.
             */
            value = this.bar.getAttribute( 'sgmagnifier:' + setting );
            if( value == undefined || value == null )
                return( this.defaults[ setting ] );
            return( isNum ? parseFloat( value ) : value );
        },

    initialize: function( el )
        {
            var pos;

            this.bar = el;
            /*  Attach to the div so that we can be found if someone
             *  needs to find us again.
             */
            this.bar.magnifier = this;

            /*  Extract our configuration values  */
            this.orientation    = this.getConfigValue( 'orientation', 0 );
            this.scalingMax     = this.getConfigValue( 'scalingmax', 1 );
            this.scalingDropOff = this.getConfigValue( 'scalingdropoff', 1 );

            pos = findPos( this.bar );
            this.initialX = pos[ 0 ];
            this.initialY = pos[ 1 ];

            pos = $(this.bar).getDimensions();
            this.initialWidth  = pos.width;
            this.initialHeight = pos.height;

            if( this.orientation == 'horizontal' )
                this.size = this.initialWidth;
            else
                this.size = this.initialHeight;

            /*  This is nasty...
             *  So that we don't screw with the styles on their div
             *  we insert two new divs into the document, one that
             *  acts like braces to hold the document flow in place,
             *  the other to detach from the flow and slide around
             *  containing our rescaled items.
             */
            this.holdingDiv = document.createElement( 'div' );
            $(this.holdingDiv).setStyle(
                {
                    width:    this.initialWidth + 'px',
                    height:   this.initialHeight + 'px'
                } );

            this.slidingDiv = document.createElement( 'div' );
            $(this.slidingDiv).setStyle(
                {
                    position: 'absolute',
                    width:    this.initialWidth + 'px',
                    height:   this.initialHeight + 'px',
                    left:     this.initialX + 'px',
                    top:      this.initialY + 'px'
                } );

            while( this.bar.firstChild )
                this.slidingDiv.appendChild( this.bar.firstChild );

            this.holdingDiv.appendChild( this.slidingDiv );
            this.bar.appendChild( this.holdingDiv );

            /*  Set up our callback methods as "normal functions" suitable
             *  to be bound as an event listener.
             */
            this._eventMouseOver =
                this._mouseOver.bindAsEventListener( this );
            this._eventMouseOut  =
                this._mouseOut.bindAsEventListener( this );
            this._eventMouseMove  =
                this._mouseMove.bindAsEventListener( this );

            /*  Bind our mouseover and mouseout to the bar  */
            Event.observe( this.bar, 'mouseover',
                this._eventMouseOver, false );
            Event.observe( this.bar, 'mouseout',
                this._eventMouseOut,  false );

            this.analyzeMagnifier();
        },

    removeMagnifier: function()
        {
            /*  Stop watching (if we are)  */
            this.stopWatching();

            /*  Unbind our events  */
            Event.stopObserving( this.bar, 'mouseover',
                this._eventMouseOver, false );
            Event.stopObserving( this.bar, 'mouseout',
                this._eventMouseOut, false );

            /*  Restore everything to normal size  */
            this.resetMagnifier();

            /*  Remove the divs we've added, and break references  */
            while( this.slidingDiv.firstChild )
                this.bar.appendChild( this.slidingDiv.firstChild );
            this.bar.removeChild( this.holdingDiv );
            this.holdingDiv.removeChild( this.slidingDiv );
            this.holdingDiv = null;
            this.slidingDiv = null;

            /*  Finally, ensure that we remove the reference to us  */
            this.bar.magnifier = null;
            this.bar = null;
        },

    analyzeMagnifier: function()
        {
            var i, els;

            this.items = new Array();

            els = $(this.bar).select( '.magnifier-item' );
            for( i = 0; i < els.length; i++ )
            {
                var pos, item;

                item = { node: els[ i ] };

                pos = findPos( els[ i ] );
                if( this.orientation == 'horizontal' )
                    item.start = pos[ 0 ] - this.initialX;
                else
                    item.start = pos[ 1 ] - this.initialY;

                pos = Element.getDimensions( els[ i ] );
                if( this.orientation == 'horizontal' )
                    item.size = pos.width;
                else
                    item.size = pos.height;
                item.initialWidth  = pos.width;
                item.initialHeight = pos.height;
                /*  This is misnamed strictly since it's 1 past the end,
                 *  but it makes things work well.
                 */
                item.end = item.start + item.size;

                this.items[ this.items.length ] = item;
            }

            //  TODO: check cursor pos against our bar to see if they're
            //    already over it?
        },

    slide: function( offset )
        {
            if( this.orientation == 'horizontal' )
                $(this.slidingDiv).setStyle(
                    {
                        left: ( this.initialX + offset ) + 'px'
                    } );
            else
               $(this.slidingDiv).setStyle(
                    {
                        top: ( this.initialY + offset ) + 'px'
                    } );
        },

    resetMagnifier: function()
        {
            for( i = 0; i < this.items.length; i++ )
                this._rescaleItem( i, 100 );
            this.slide( 0 );
        },

    redrawMagnifier: function( pos )
        {
            var i, j, offset;

            if( pos < 0 || pos > this.size )
            {
                this.resetMagnifier();
                return;
            }

            i = 0;
            while( i < this.items.length && pos > this.items[ i ].end )
                i++;

            offset = 0;
            for( j = 0; j < this.items.length; j++ )
            {
                var distance, diff;

                if( j == i )
                    distance = 0;
                else if( j < i )
                    distance = pos - this.items[ j ].end;
                else
                    distance = this.items[ j ].start - pos;

                //  TODO: configurable distance => scaling function?
                diff = this._rescaleItem( j,
                    this.scalingMax - ( distance * this.scalingDropOff ) );

                if( j < i )
                    offset += diff;
                else if( j == i )
                    offset += Math.floor(
                        diff * ( pos - this.items[ j ].start ) /
                        this.items[ j ].size );
            }

            this.slide( -offset );
        },

    _rescaleItem: function( itemNo, scale )
        {
            var item, pos;

            item = this.items[ itemNo ];

            if( scale < 100 )
                scale = 100;

            this.resizeItem(
                item.node, item.initialWidth, item.initialHeight, scale );

            pos = Element.getDimensions( item.node );
            if( this.orientation == 'horizontal' )
                return( pos.width - item.initialWidth );
            else
                return( pos.height - item.initialHeight );
        },

    /*  This can be redefined if you want to do something funkier  */
    resizeItem: function( item, originalWidth, originalHeight, factor )
        {
            //  TODO: set via the CSS properties
            item.width  = Math.floor( ( originalWidth * factor ) / 100 );
            item.height = Math.floor( ( originalHeight * factor ) / 100 );
        },

    startWatching: function()
        {
            if( this.watching )
                return;
            Event.observe( this.bar, 'mousemove', this._eventMouseMove,
                false );
            this.watching = true;
        },
    stopWatching: function()
        {
            if( !this.watching )
                return;
            Event.stopObserving( this.bar, 'mousemove', this._eventMouseMove,
                false );
            this.watching = false;
            this.resetMagnifier();
        },

    _mouseOver: function( e )
        {
//            var el     = Event.element( e );
//            var elFrom = e.relatedTarget || e.fromElement;

            this.startWatching();
        },
    _mouseOut: function( e )
        {
            var el     = Event.element( e );
            var elTo = e.relatedTarget || e.toElement;

            while( elTo && elTo != this.bar && elTo.nodeName != 'BODY' )
                elTo = elTo.parentNode;

            if( elTo == this.bar )
                return;

            this.stopWatching();
        },

    _mouseMove: function( e )
        {
            if( this.orientation == 'horizontal' )
                this.redrawMagnifier( Event.pointerX( e ) - this.initialX );
            else
                this.redrawMagnifier( Event.pointerY( e ) - this.initialY );
        }

    };

function scanForMagnifiers()
{
    var i, els;

    els = $$('.magnifier-bar');
    for( i = 0; i < els.length; i++ )
        new Magnifier( els[ i ] );
}

if( document.loaded )
    scanForMagnifiers();
else
    Event.observe( document, 'dom:loaded', scanForMagnifiers, false );
