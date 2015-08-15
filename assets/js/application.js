// settings for atv.player - communicated in PlayVideo/videoPlayerSettings
var baseURL;
var accessToken;
var showClock, timeFormat, clockPosition, overscanAdjust;
var showEndtime;
var subtitleSize;


// metadata - communicated in PlayVideo/myMetadata
var mediaURL;
var key;
var ratingKey;
var duration, partDuration;  // milli-sec (int)
var subtitleURL;
var videoName;
var videoName2;
var videoName3;
var videoName4;
var videoName5;
var videoName6;
var videoName7;
var videoName8;
var videoName9;
var videoName10;
var videoName11;
var videoName12;
var videoName13;
var videoName14;
var videoName15;
var videoName16;
var videoName17;
var videoName18;
var poster;
var showInfos;
var overlaysVisible;


// information for atv.player - computed internally to application.js
var lastReportedTime = -1;
var lastTranscoderPingTime = -1;
var remainingTime = 0;
var startTime = 0;  // milli-sec
var isTranscoding = false;



/*
 * Send http request
 */
function loadPage(url)
{
  var req = new XMLHttpRequest();
  req.open('GET', url, true);
  req.send();
};

/*
 * ATVLogger
 */
function log(msg, level)
{
    level = level || 1;
    var req = new XMLHttpRequest();
    var url = "{{URL(/)}}" + "&PlexConnectATVLogLevel=" + level.toString() + "&PlexConnectLog=" + encodeURIComponent(msg);
    req.open('GET', url, true);
    req.send();
};

 /*
  * Handle ATV player time change
  */
atv.player.playerTimeDidChange = function(time)
{
  remainingTime = Math.round((duration / 1000) - time);
  var thisReportTime = Math.round(time*1000)
  
  // correct thisReportTime with startTime if stacked media part
  thisReportTime += startTime;
  
  // report watched time
  if (lastReportedTime == -1 || Math.abs(thisReportTime-lastReportedTime) > 5000)
  {
    lastReportedTime = thisReportTime;
    var token = '';
    if (accessToken!='')
        token = '&X-Plex-Token=' + accessToken;
    loadPage( baseURL + '/:/timeline?ratingKey=' + ratingKey + 
                        '&key=' + key +
                        '&duration=' + duration.toString() + 
                        '&state=playing' +
                        '&time=' + thisReportTime.toString() + 
                        '&X-Plex-Client-Identifier=' + atv.device.udid + 
                        '&X-Plex-Device-Name=' + encodeURIComponent(atv.device.displayName) +
                        token );
  }
  
  // ping transcoder to keep it alive
  if (isTranscoding &&
       (lastTranscoderPingTime == -1 || Math.abs(thisReportTime-lastTranscoderPingTime) > 60000)
     )
  {
    lastTranscoderPingTime = thisReportTime;
    loadPage( baseURL + '/video/:/transcode/universal/ping?session=' + atv.device.udid);
  }
  
  if (subtitle)
      updateSubtitle(thisReportTime);
};

/*
 * Handle ATV playback stopped
 */
atv.player.didStopPlaying = function()
{	
  // Remove views
  if (clockTimer) atv.clearInterval(clockTimer);
  if (endTimer) atv.clearInterval(endTimer);
  Views = [];  
  
  // Notify of a stop.
  var token = '';
  if (accessToken!='')
      token = '&X-Plex-Token=' + accessToken;
  loadPage( baseURL + '/:/timeline?ratingKey=' + ratingKey + 
                      '&key=' + key +
                      '&duration=' + duration.toString() + 
                      '&state=stopped' +
                      '&time=' + lastReportedTime.toString() + 
                      '&X-Plex-Client-Identifier=' + atv.device.udid + 
                      '&X-Plex-Device-Name=' + encodeURIComponent(atv.device.displayName) +
                      token );
    
  // Kill the transcoder session.
  if (isTranscoding)
  {
    loadPage(baseURL + '/video/:/transcode/universal/stop?session=' + atv.device.udid);
  }
};

/*
 * Handle ATV playback will start
 */
atv.player.willStartPlaying = function()
{
    // init timer vars
    lastReportedTime = -1;
    lastTranscoderPingTime = -1;
    remainingTime = 0;  // reset remaining time
    startTime = 0;  // starting time for stacked media subsequent parts
    //todo: work <bookmarkTime> and fix "resume" for stacked media
    
    // get baseURL, OSD settings, ...
    var videoPlayerSettings = atv.player.asset.getElementByTagName('videoPlayerSettings');
    if (videoPlayerSettings != null)
    {
        baseURL = videoPlayerSettings.getTextContent('baseURL');
        accessToken = videoPlayerSettings.getTextContent('accessToken');
        
        showClock = videoPlayerSettings.getTextContent('showClock');
        timeFormat = videoPlayerSettings.getTextContent('timeFormat');
        clockPosition = videoPlayerSettings.getTextContent('clockPosition');
        overscanAdjust = videoPlayerSettings.getTextContent('overscanAdjust');
        showEndtime = videoPlayerSettings.getTextContent('showEndtime');
        showInfos = videoPlayerSettings.getTextContent('showInfos');
        
        subtitleSize = videoPlayerSettings.getTextContent('subtitleSize');
        log('willStartPlaying/getVideoPlayerSettings done');
    }
    
    // mediaURL and myMetadata
    getMetadata();
    
  // load subtitle - aTV subtitle JSON
  subtitle = [];
  subtitlePos = 0;
  // when... not transcoding or
  //         transcoding and PMS skips subtitle (dontBurnIn)
  if (subtitleURL &&
       ( !isTranscoding ||
         isTranscoding && mediaURL.indexOf('skipSubtitles=1') > -1 )
     )
  {
    log("subtitleURL: "+subtitleURL);
    
    // read subtitle stream
    var req = new XMLHttpRequest();
    req.onreadystatechange = function()
    {
        if (req.readyState==4)  // 4: request is complete
        {
            subtitle = JSON.parse(req.responseText);
        }
    };
    req.open('GET', subtitleURL+"&PlexConnectUDID=" + atv.device.udid, true);  // true: asynchronous
    req.send();
    log('willStartPlaying/parseSubtitleJSON done');
  }
  
  var Views = [];
  // Dummy animation to make sure clocks start as hidden
  var animation = {"type": "BasicAnimation", "keyPath": "opacity",
                  "fromValue": 0, "toValue": 0, "duration": 0,
                  "removedOnCompletion": false, "fillMode": "forwards",
                  "animationDidStop": function(finished) {} };
  
  // Create clock view
  containerView.frame = screenFrame; 
  
  if (showInfos == "True")
  {  
      overlay = initOverlay();
      Views.push(overlay);
      overlay.addAnimation(animation, overlay);
      
      infoView = initVideoInfoView();
      Views.push(infoView);
      infoView.addAnimation(animation, infoView);
      
      infoView2 = initVideoInfoView2();
      Views.push(infoView2);
      infoView2.addAnimation(animation, infoView2);
      
      infoView3 = initVideoInfoView3();
      Views.push(infoView3);
      infoView3.addAnimation(animation, infoView3);
      
      infoView4 = initVideoInfoView4();
      Views.push(infoView4);
      infoView4.addAnimation(animation, infoView4);
      
      infoView5 = initVideoInfoView5();
      Views.push(infoView5);
      infoView5.addAnimation(animation, infoView5);
      
      infoView6 = initVideoInfoView6();
      Views.push(infoView6);
      infoView6.addAnimation(animation, infoView6);
      
      infoView7 = initVideoInfoView7();
      Views.push(infoView7);
      infoView7.addAnimation(animation, infoView7);
      
      infoView8 = initVideoInfoView8();
      Views.push(infoView8);
      infoView8.addAnimation(animation, infoView8);
      
      infoView9 = initVideoInfoView9();
      Views.push(infoView9);
      infoView9.addAnimation(animation, infoView9);
      
      infoView10 = initVideoInfoView10();
      Views.push(infoView10);
      infoView10.addAnimation(animation, infoView10);
      
      infoView11 = initVideoInfoView11();
      Views.push(infoView11);
      infoView11.addAnimation(animation, infoView11);
      
      infoView12 = initVideoInfoView12();
      Views.push(infoView12);
      infoView12.addAnimation(animation, infoView12);
      
      infoView13 = initVideoInfoView13();
      Views.push(infoView13);
      infoView13.addAnimation(animation, infoView13);
      
      infoView14 = initVideoInfoView14();
      Views.push(infoView14);
      infoView14.addAnimation(animation, infoView14);
      
      infoView15 = initVideoInfoView15();
      Views.push(infoView15);
      infoView15.addAnimation(animation, infoView15);
      
      infoView16 = initVideoInfoView16();
      Views.push(infoView16);
      infoView16.addAnimation(animation, infoView16);
      
      infoView17 = initVideoInfoView17();
      Views.push(infoView17);
      infoView17.addAnimation(animation, infoView17);
      
      infoView18 = initVideoInfoView18();
      Views.push(infoView18);
      infoView18.addAnimation(animation, infoView18);
      
      posterView = initPosterView();
      Views.push(posterView);
      posterView.addAnimation(animation, posterView);
      
      posterView2 = initPosterView2();
      Views.push(posterView2);
      posterView2.addAnimation(animation, posterView2);
  }
    
  if (showClock == "True")
  {
      clockView = initClockView();
      Views.push(clockView);
      clockView.addAnimation(animation, clockView)
  }
  if (duration > 0 ) // TODO: grab video length from player not library????
  {
    if (showEndtime == "True")
    {
        endTimeView = initEndTimeView();
        Views.push(endTimeView);
        endTimeView.addAnimation(animation, endTimeView)
    }
  }
  log('willStartPlaying/createClockView done');
  
  // create subtitle view
  if (subtitleURL &&
       ( !isTranscoding ||
         isTranscoding && mediaURL.indexOf('skipSubtitles=1') > -1 )
     )
  {
      subtitleView = initSubtitleView();
      for (var i=0;i<subtitleMaxLines;i++)
      {
          Views.push(subtitleView['shadowRB'][i]);
          Views.push(subtitleView['subtitle'][i]);
      }
      log('willStartPlaying/createSubtitleView done');
  }
  
  // Paint the views on Screen.
  containerView.subviews = Views;
  atv.player.overlay = containerView;

  log('willStartPlaying done');
};


/*
 * Playlist handling
 */

var assettimer = null;

atv.player.loadMoreAssets = function(callback) 
{
    assettimer = atv.setInterval(
        function()
        {
            atv.clearInterval(assettimer);
            
            var root = atv.player.asset;
            var videoAssets = root.getElementsByTagName('httpFileVideoAsset');
            if (videoAssets != null && videoAssets.length > 1)
                videoAssets.shift();
            else
                videoAssets = null;
            callback.success(videoAssets);
            
            log('loadMoreAssets done');
        } , 1000);
}


atv.player.currentAssetChanged = function()
{
    // start time for stacked media
    var lastRatingKey = ratingKey;
    startTime += partDuration;
    
    getMetadata();
    
    // reset start time on media change (non-stacked)
    if (lastRatingKey != ratingKey)
        startTime = 0;
    
    log('currentAssetChanged done');
}


function getMetadata()
{
    // update mediaURL and myMetadata
    mediaURL = atv.player.asset.getTextContent('mediaURL');
    isTranscoding = (mediaURL.indexOf('transcode/universal') > -1);
    
    var metadata = atv.player.asset.getElementByTagName('myMetadata');
    if (metadata != null)
    {
        key = metadata.getTextContent('key');
        ratingKey = metadata.getTextContent('ratingKey');
        duration = parseInt(metadata.getTextContent('duration'));
        partDuration = parseInt(metadata.getTextContent('partDuration'));
        
        // todo: subtitle handling with playlists/stacked media
        subtitleURL = metadata.getTextContent('subtitleURL');
        
        videoName = metadata.getTextContent('summary');
        videoName2 = metadata.getTextContent('show');
        videoName3 = metadata.getTextContent('show2');
        videoName4 = metadata.getTextContent('show3');
        videoName5 = metadata.getTextContent('show4');
        videoName6 = metadata.getTextContent('show5');
        videoName7 = metadata.getTextContent('show6');
        videoName8 = metadata.getTextContent('show7');
        videoName9 = metadata.getTextContent('show8');
        videoName10 = metadata.getTextContent('show9');
        videoName11 = metadata.getTextContent('show10');
        videoName12 = metadata.getTextContent('show11');
        videoName13 = metadata.getTextContent('show12');
        videoName14 = metadata.getTextContent('show13');
        videoName15 = metadata.getTextContent('show14');
        videoName16 = metadata.getTextContent('show15');
        videoName17 = metadata.getTextContent('show16');
        videoName18 = metadata.getTextContent('show17');
        poster = metadata.getTextContent('poster');
        thumb = metadata.getTextContent('epsThumb');
        log('updateMetadata/getMetadata done');
    }
    log('updateMetadata done');
}


// atv.Element extensions
if( atv.Element ) {
	atv.Element.prototype.getElementsByTagName = function(tagName) {
		return this.ownerDocument.evaluateXPath("descendant::" + tagName, this);
	}

	atv.Element.prototype.getElementByTagName = function(tagName) {
		var elements = this.getElementsByTagName(tagName);
		if ( elements && elements.length > 0 ) {
			return elements[0];
		}
		return undefined;
	}

    // getTextContent - return empty string if node not existing.
    atv.Element.prototype.getTextContent = function(tagName) {
        var element = this.getElementByTagName(tagName);
        if (element && element.textContent)
            return element.textContent;
        else
            return '';
    }
}


var statePause = 0;

/*
 * Handle showing/hiding of transport controls
 */
atv.player.onTransportControlsDisplayed = function(animationDuration)
{
    showOverlays(0);
};

atv.player.onTransportControlsHidden = function(animationDuration)
{
    if (statePause == 0)  hideOverlays(0);
};


/*
 * Show / Hide Overlay
 */

showOverlays = function(animationDuration)
{
    var animation = {"type": "BasicAnimation", "keyPath": "opacity",
        "fromValue": 0, "toValue": 1, "duration": animationDuration,
        "removedOnCompletion": false, "fillMode": "forwards",
        "animationDidStop": function(finished) {} };
    if (showClock == "True") clockView.addAnimation(animation, clockView);
    if (showEndtime == "True") endTimeView.addAnimation(animation, endTimeView);
    if (showInfos == "True") {
        overlay.addAnimation(animation, overlay);
        infoView.addAnimation(animation, infoView);
        infoView2.addAnimation(animation, infoView2);
        infoView3.addAnimation(animation, infoView3);
        infoView4.addAnimation(animation, infoView4);
        infoView5.addAnimation(animation, infoView5);
        infoView6.addAnimation(animation, infoView6);
        infoView7.addAnimation(animation, infoView7);
        infoView8.addAnimation(animation, infoView8);
        infoView9.addAnimation(animation, infoView9);
        infoView10.addAnimation(animation, infoView10);
        infoView11.addAnimation(animation, infoView11);
        infoView12.addAnimation(animation, infoView12);
        infoView13.addAnimation(animation, infoView13);
        infoView14.addAnimation(animation, infoView14);
        infoView15.addAnimation(animation, infoView15);
        infoView16.addAnimation(animation, infoView16);
        infoView17.addAnimation(animation, infoView17);
        infoView18.addAnimation(animation, infoView18);
        posterView.addAnimation(animation, posterView);
        posterView2.addAnimation(animation, posterView2);
    }
};

hideOverlays = function(animationDuration)
{
    var animation = {"type": "BasicAnimation", "keyPath": "opacity",
        "fromValue": 1, "toValue": 0, "duration": animationDuration,
        "removedOnCompletion": false, "fillMode": "forwards",
        "animationDidStop": function(finished) {} };
    if (showClock == "True") clockView.addAnimation(animation, clockView);
    if (showEndtime == "True") endTimeView.addAnimation(animation, endTimeView);
    if (showInfos == "True") {
        overlay.addAnimation(animation, overlay);
        infoView.addAnimation(animation, infoView);
        infoView2.addAnimation(animation, infoView2);
        infoView3.addAnimation(animation, infoView3);
        infoView4.addAnimation(animation, infoView4);
        infoView5.addAnimation(animation, infoView5);
        infoView6.addAnimation(animation, infoView6);
        infoView7.addAnimation(animation, infoView7);
        infoView8.addAnimation(animation, infoView8);
        infoView9.addAnimation(animation, infoView9);
        infoView10.addAnimation(animation, infoView10);
        infoView11.addAnimation(animation, infoView11);
        infoView12.addAnimation(animation, infoView12);
        infoView13.addAnimation(animation, infoView13);
        infoView14.addAnimation(animation, infoView14);
        infoView15.addAnimation(animation, infoView15);
        infoView16.addAnimation(animation, infoView16);
        infoView17.addAnimation(animation, infoView17);
        infoView18.addAnimation(animation, infoView18);
        posterView.addAnimation(animation, posterView);
        posterView2.addAnimation(animation, posterView2);
    }
};

/*
 * Handle ATV player state changes
 */
 
var pingTimer = null;
 
atv.player.playerStateChanged = function(newState, timeIntervalSec) {
  log("Player state: " + newState + " at this time: " + timeIntervalSec);
  state = null;

  // Pause state, ping transcoder to keep session alive
  if (newState == 'Paused')
  {
    state = 'paused';
    if (isTranscoding)
    {
      pingTimer = atv.setInterval(
        function() { loadPage( baseURL + '/video/:/transcode/universal/ping?session=' + atv.device.udid); },
        60000
      );
    }
      showOverlays(0.1);
      statePause = 1;
  }

  // Playing state, kill paused state ping timer
  if (newState == 'Playing')
  {
    state = 'play'
    atv.clearInterval(pingTimer);
      statePause = 0;
  }

  // Loading state, tell PMS we're buffering
  if (newState == 'Loading')
  {
    state = 'buffering';
  }

  if (state != null)
  {
  var thisReportTime = Math.round(timeIntervalSec*1000);
  
  // correct thisReportTime with startTime if stacked media part
  thisReportTime += startTime;
  
  var token = '';
  if (accessToken!='')
      token = '&X-Plex-Token=' + accessToken;
  loadPage( baseURL + '/:/timeline?ratingKey=' + ratingKey + 
                      '&key=' + key +
                      '&duration=' + duration.toString() + 
                      '&state=' + state + 
                      '&time=' + thisReportTime.toString() + 
                      '&report=1' +
                      '&X-Plex-Client-Identifier=' + atv.device.udid + 
                      '&X-Plex-Device-Name=' + encodeURIComponent(atv.device.displayName) +
                      token );
  }
};


/*
 *
 * Clock + End time rendering
 *
 */

var screenFrame = atv.device.screenFrame;
var containerView = new atv.View();
var clockView;
var clockTimer;
var endTimeView;
var endTimer;
var overlay;
var posterView;
var posterView2;
var infoView;
var infoView3;
var infoView4;
var infoView5;
var infoView6;
var infoView7;
var infoView8;
var infoView9;
var infoView10;
var infoView11;
var infoView12;
var infoView13;
var infoView14;
var infoView15;
var infoView16;
var infoView17;
var infoView18;


function pad(num, len) {return (Array(len).join("0") + num).slice(-len);};
//Poster Overlay
function initPosterView()
{
    var posterView = new atv.ImageView();
    
    var x = (screenFrame.width / 100.0) * 10.0; // X pos 10% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 49.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 40.0;// Height is 40% of screen height
    var width = height * 0.69;// Calculate width from height times poster aspect ratio
    posterView.frame = {x: x, y: y, width: width, height: height};
    posterView.loadImageAtURL(poster);
    return posterView;
}
//Fanart Overlay
function initPosterView2()
{
    var posterView2 = new atv.ImageView();
    
    var x = (screenFrame.width / 100.0) * 10.0; // X pos 10% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 18.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 40.0;// Height is 40% of screen height
    var width = height * 0.69;// Calculate width from height times poster aspect ratio
    posterView2.frame = {x: x, y: y, width: width, height: height};
    posterView2.loadImageAtURL(thumb);
    return posterView2;
}
//Tint Overlay
function initOverlay()
{
    overlay = new atv.View();
    overlay.frame = {x: screenFrame.x, y: screenFrame.y, width: screenFrame.width, height: screenFrame.height};
    overlay.backgroundColor = { red: 0, green: 0, blue: 0, alpha: 0.7 };
    return overlay;
}

//Title Show
function initVideoInfoView()
{
    infoView = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 30.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 83.0; // Y pos 70% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 7.0;// Height is 5% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView.frame = {x: x, y: y, width: width, height: height};
    //infoView.backgroundColor = { red: 0, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView.attributedString = {string: " " + videoName2, attributes: {pointSize: 36.0, color: {red: 1, blue: 1, green: 1}, alignment: "left", weight: "light"}};
    return infoView;
}
// Show 2
function initVideoInfoView3()
{
    infoView3 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 30.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 42.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 25.0;// Width is 60% of screen width
    
    infoView3.frame = {x: x, y: y, width: width, height: height};
    //infoView2.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView3.attributedString = {string: " " + videoName3, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, alignment: "left", weight: "light"}};
    return infoView3;
}
// Show 3
function initVideoInfoView4()
{
    infoView4 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 30.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 47.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 25.0;// Width is 60% of screen width
    
    infoView4.frame = {x: x, y: y, width: width, height: height};
    //infoView4.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView4.attributedString = {string: " " + videoName4, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, alignment: "left", weight: "light"}};
    return infoView4;
}
// Show 4
function initVideoInfoView5()
{
    infoView5 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 60.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 37.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView5.frame = {x: x, y: y, width: width, height: height};
    //infoView2.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView5.attributedString = {string: " " + videoName5, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView5;
}
// Show 5
function initVideoInfoView6()
{
    infoView6 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 60.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 47.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView6.frame = {x: x, y: y, width: width, height: height};
    //infoView2.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView6.attributedString = {string: " " + videoName6, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView6;
}
// Show 6
function initVideoInfoView7()
{
    infoView7 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 30.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 37.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView7.frame = {x: x, y: y, width: width, height: height};
    //infoView7.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView7.attributedString = {string: " " + videoName7, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView7;
}
// Show 7
function initVideoInfoView8()
{
    infoView8 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 60.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 42.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView8.frame = {x: x, y: y, width: width, height: height};
    //infoView8.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView8.attributedString = {string: " " + videoName8, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView8;
}
// Show 8
function initVideoInfoView9()
{
    infoView9 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 70.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 42.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView9.frame = {x: x, y: y, width: width, height: height};
    //infoView9.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView9.attributedString = {string: " " + videoName9, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView9;
}
// Show 9
function initVideoInfoView10()
{
    infoView10 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 70.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 37.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView10.frame = {x: x, y: y, width: width, height: height};
    //infoView10.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView10.attributedString = {string: " " + videoName10, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView10;
}
// Show 10
function initVideoInfoView11()
{
    infoView11 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 60.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 32.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView11.frame = {x: x, y: y, width: width, height: height};
    //infoView11.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView11.attributedString = {string: " " + videoName11, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView11;
}
// Show 11
function initVideoInfoView12()
{
    infoView12 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 70.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 47.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView12.frame = {x: x, y: y, width: width, height: height};
    //infoView12.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView12.attributedString = {string: " " + videoName12, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView12;
}
// Show 12
function initVideoInfoView13()
{
    infoView13 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 70.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 32.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView13.frame = {x: x, y: y, width: width, height: height};
    //infoView13.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView13.attributedString = {string: " " + videoName13, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView13;
}
// Show 13
function initVideoInfoView14()
{
    infoView14 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 70.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 27.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView14.frame = {x: x, y: y, width: width, height: height};
    //infoView14.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView14.attributedString = {string: " " + videoName14, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView14;
}
// Show 14
function initVideoInfoView15()
{
    infoView15 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 70.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 22.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView15.frame = {x: x, y: y, width: width, height: height};
    //infoView15.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView15.attributedString = {string: " " + videoName15, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView15;
}
// Show 15
function initVideoInfoView16()
{
    infoView16 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 30.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 22.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView16.frame = {x: x, y: y, width: width, height: height};
    //infoView16.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView16.attributedString = {string: " " + videoName16, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView16;
}
// Show 16
function initVideoInfoView17()
{
    infoView17 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 30.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 32.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView17.frame = {x: x, y: y, width: width, height: height};
    //infoView17.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView17.attributedString = {string: " " + videoName17, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView17;
}
// Show 17
function initVideoInfoView18()
{
    infoView18 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 30.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 27.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 35.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView18.frame = {x: x, y: y, width: width, height: height};
    //infoView14.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView18.attributedString = {string: " " + videoName18, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView18;
}
// Summary Info
function initVideoInfoView2()
{
    infoView2 = new atv.TextView();
    var x = (screenFrame.width / 100.0) * 30.0; // X pos 30% of screen width from left edge
    var y = (screenFrame.height / 100.0) * 14.0; // Y pos 35% of screen height from bottom edge
    var height = (screenFrame.height / 100.0) * 32.0;// Height is 35% of screen height
    var width = (screenFrame.width / 100.0) * 60.0;// Width is 60% of screen width
    
    infoView2.frame = {x: x, y: y, width: width, height: height};
    //infoView2.backgroundColor = { red: 1, green: 0, blue: 1, alpha: 0.7 };// Uncomment to show debug color
    infoView2.attributedString = {string: " " + videoName, attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, breakMode: "word-wrap", alignment: "left", weight: "light"}};
    return infoView2;
}
function initClockView()
{
    clockView = new atv.TextView();
    var width = screenFrame.width * 0.20;
    if (timeFormat == '24 Hour')
    {
        width = screenFrame.width * 0.25;
    }
    var height = screenFrame.height * 0.08;
    var overscanadjust = 0.008 * (parseInt(overscanAdjust));
    var xmul = 0.17; //Default for Left Position
    if (clockPosition == 'Center') var xmul = 0.5;
    else if (clockPosition == 'Right') var xmul = 0.9;
    
    
    // Setup the clock frame
    if (showInfos == "False") clockView.backgroundColor = { red: 0, blue: 0, green: 0, alpha: 0.7};
    clockView.frame = { "x": screenFrame.x + (screenFrame.width * xmul) - (width * 0.5),
        "y": screenFrame.y + (screenFrame.height * (0.27 + overscanadjust)) - height,
        "width": width, "height": height };
    
    // Update the overlay clock
    clockTimer = atv.setInterval( updateClock, 1000 );
    updateClock();
    
    return clockView;
}

function initEndTimeView()
{
    endTimeView = new atv.TextView();
    var width = screenFrame.width * 0.20;
    if (timeFormat == '12 Hour')
    {
        width = screenFrame.width * 0.25;
    }
    var height = screenFrame.height * 0.3;
    var overscanadjust = 0.008 * (parseInt(overscanAdjust));
    var xmul = 0.17; // Default for Left Position
    if (clockPosition == 'Center') var xmul = 0.5;
    else if (clockPosition == 'Right') var xmul = 0.88;
    
    // Setup the end time frame
    if (showInfos == "False") endTimeView.backgroundColor = { red: 0, blue: 0, green: 0, alpha: 0.7};
    endTimeView.frame = { "x": screenFrame.x + (screenFrame.width * xmul) - (width * 0.5),
        "y": screenFrame.y + (screenFrame.height * (0.21 - overscanadjust)) - height,
        "width": width, "height": height };
    
    // Update the overlay clock
    endTimer = atv.setInterval( updateEndTime, 1000 );
    updateEndTime();
    
    return endTimeView;
}

function updateClock()
{
    var tail = "AM";
    var time = new Date();
    var hours24 = pad(time.getHours(), 2);
    var h12 = parseInt(hours24);
    if (h12 > 12) {h12 = h12 - 12; tail = "PM";}
    else if (h12 == 12) {tail = "PM";}
    else if (h12 == 0) {h12 = 12; tail = "AM";}
    hours12 = h12.toString();
    var mins = pad(time.getMinutes(), 2);
    var secs = pad(time.getSeconds(), 2);
    var timestr24 = hours24 + ":" + mins;
    var timestr12 = hours12 + ":" + mins + " " + tail;
    var TimeStrC = "Time:  "
    if (timeFormat == '24 Hour')
    {
        clockView.attributedString = {string: "" + TimeStrC + timestr24,
            attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, alignment: "center", weight: "light"}};
    }
    else
    {
        clockView.attributedString = {string: "" + TimeStrC + timestr12,
            attributes: {pointSize: 24.0, color: {red: 1, blue: 1, green: 1}, alignment: "center", weight: "light"}};
    }
};

function updateEndTime()
{
    var tail = "AM";
    var time = new Date();
    var intHours = parseInt(time.getHours());
    var intMins = parseInt(time.getMinutes());
    var intSecs = parseInt(time.getSeconds());
    var totalTimeInSecs = ((intHours * 3600) + (intMins * 60) + intSecs) + remainingTime;
    var endHours = Math.floor(totalTimeInSecs / 3600);
    if (endHours >= 24) { endHours = endHours - 24; }
    var endMins = Math.floor((totalTimeInSecs % 3600) / 60);
    var hours24 = pad(endHours.toString(), 2);
    var h12 = endHours;
    if (h12 > 12) { h12 = h12 - 12; tail = "PM"; }
    else if (h12 == 12) { tail = "PM"; }
    else if (h12 == 0) { h12 = 12; tail = "AM"; }
    hours12 = h12.toString();
    var mins = pad(endMins.toString(), 2);
    var timestr24 = hours24 + ":" + mins;
    var timestr12 = hours12 + ":" + mins + " " + tail;
    var endTimeStr = "Ends at:  "
    if (timeFormat == '24 Hour') { endTimeStr = endTimeStr + timestr24; }
    else { endTimeStr = endTimeStr + timestr12; }
    //if (remainingTime == 0) { endTimeStr = ''; endTimeView.backgroundColor = { red: 0, blue: 0, green: 0, alpha: 0};}
    //else { endTimeView.backgroundColor = { red: 0, blue: 0, green: 0, alpha: 0.7};}
    
    endTimeView.attributedString = {string: endTimeStr,
        attributes: {pointSize: 20.0, color: {red: 1, blue: 1, green: 1}, alignment: "center"}};
};

/*
 *
 * Subtitle handling/rendering
 *
 */
var subtitleView = {'shadowRB': [], 'subtitle': []};
var subtitle = [];
var subtitlePos = 0;
// constants
var subtitleMaxLines = 4;


function initSubtitleView()
{
  var width = screenFrame.width;
  var height = screenFrame.height * 1/14 * subtitleSize/100;  // line height: 1/14 seems to fit to 40pt font
  
  var xOffset = screenFrame.width * 1/640;  // offset for black letter shadow/border/background
  var yOffset = screenFrame.height * 1/360;
  
  // Setup the subtitle frames
  for (var i=0;i<subtitleMaxLines;i++)
  {
    // shadow right bottom
    subtitleView['shadowRB'][i] = new atv.TextView();
    subtitleView['shadowRB'][i].backgroundColor = { red: 0, blue: 0, green: 0, alpha: 0.0};
    subtitleView['shadowRB'][i].frame = { "x": screenFrame.x + xOffset,
                                          "y": screenFrame.y - yOffset + (height * (subtitleMaxLines-i-0.5)),
                                          "width": width, "height": height
                                        };
    // subtitle
    subtitleView['subtitle'][i] = new atv.TextView();
    subtitleView['subtitle'][i].backgroundColor = { red: 0, blue: 0, green: 0, alpha: 0.0};
    subtitleView['subtitle'][i].frame = { "x": screenFrame.x,
                                          "y": screenFrame.y + (height * (subtitleMaxLines-i-0.5)),
                                          "width": width, "height": height
                                        };
  }
  
  return subtitleView;
}


function updateSubtitle(time)
{
    // rewind, if needed
    while(subtitlePos>0 && time<subtitle.Timestamp[subtitlePos].time)
    {
        subtitlePos--;
    }
    // forward
    while(subtitlePos<subtitle.Timestamp.length-1 && time>subtitle.Timestamp[subtitlePos+1].time)
    {
        subtitlePos++;
    }
    // current subtitle to show: subtitle.Timestamp[subtitlePos]
    
    // get number of lines (max subtitleMaxLines)
    var lines
    if (subtitle.Timestamp[subtitlePos].Line)
        lines = Math.min(subtitle.Timestamp[subtitlePos].Line.length, subtitleMaxLines);
    else
        lines = 0;
    
    // update subtitleView[]
    var i_view=0;
    for (var i=0;i<subtitleMaxLines-lines;i++)  // fill empty lines on top
    {
        subtitleView['shadowRB'][i_view].attributedString = {
            string: "",
            attributes: { pointSize: 40.0 * subtitleSize/100,
                          color: {red: 0, blue: 0, green: 0, alpha: 1.0}
                        }
        };
        subtitleView['subtitle'][i_view].attributedString = {
            string: "",
            attributes: { pointSize: 40.0 * subtitleSize/100,
                          color: {red: 1, blue: 1, green: 1, alpha: 1.0}
                        }
        };
        i_view++;
    }
    for (var i=0;i<lines;i++)  // fill used lines
    {
        subtitleView['shadowRB'][i_view].attributedString = {
            string: subtitle.Timestamp[subtitlePos].Line[i].text,
            attributes: { pointSize: 40.0 * subtitleSize/100,
                          color: {red: 0, blue: 0, green: 0, alpha: 1.0},
                          weight: subtitle.Timestamp[subtitlePos].Line[i].weight || 'normal',
                          alignment: "center",
                          breakMode: "clip"
                        }
        };
        subtitleView['subtitle'][i_view].attributedString = {
            string: subtitle.Timestamp[subtitlePos].Line[i].text,
            attributes: { pointSize: 40.0 * subtitleSize/100,
                          color: {red: 1, blue: 1, green: 1, alpha: 1.0},
                          weight: subtitle.Timestamp[subtitlePos].Line[i].weight || 'normal',
                          alignment: "center",
                          breakMode: "clip"
                        }
        };
        i_view++;
    }
    
    if (time<10000)
        log("updateSubtitle done, subtitlePos="+subtitlePos);
}


/*
 *
 * Main app entry point
 *
 */

atv.config = { 
    "doesJavaScriptLoadRoot": true,
    "DEBUG_LEVEL": 4
};

atv.onAppEntry = function()
{
    fv = atv.device.softwareVersion.split(".");
    firmVer = fv[0] + "." + fv[1];
    if (parseFloat(firmVer) >= 5.1)
    {
        // discover - trigger PlexConnect, ignore response
        var url = "{{URL(/)}}&PlexConnect=Discover&PlexConnectUDID="+atv.device.udid
        var req = new XMLHttpRequest();
        req.open('GET', url, false);
        req.send();
        
        // load main page
        atv.loadURL("{{URL(/PlexConnect.xml)}}");
    }
    else
    {
        var xmlstr =
"<?xml version=\"1.0\" encoding=\"UTF-8\"?> \
<atv> \
  <body> \
    <dialog id=\"com.sample.error-dialog\"> \
      <title>{{TEXT(PlexConnect)}}</title> \
      <description>{{TEXT(ATV firmware version 5.1 or higher required. Please think about updating.)}}</description> \
    </dialog> \
  </body> \
</atv>";
        
        var doc = atv.parseXML(xmlstr);
        atv.loadXML(doc);
    }
};

// atv.onGenerateRequest - adding UDID if directed to PlexConnect
atv.onGenerateRequest = function(request)
{
    //log("atv.onGenerateRequest: "+request.url);
    
    if (request.url.indexOf("{{URL(/)}}")!=-1)
    {
        var sep = "&";
            // check for "&", too. some PlexConnect requests don't follow the standard.
        if (request.url.indexOf("?")==-1 && request.url.indexOf("&")==-1)
        {
            sep = "?";
        }
        request.url = request.url +sep+ "PlexConnectUDID=" + atv.device.udid;
        request.url = request.url +"&"+ "PlexConnectATVName=" + encodeURIComponent(atv.device.displayName);
    }
    
    log("atv.onGenerateRequest done: "+request.url);
}
