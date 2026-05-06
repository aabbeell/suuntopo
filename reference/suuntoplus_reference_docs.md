SuuntoPlus app reference
Requirements
SuuntoPlus Editor is supported on the following platforms:

Windows 8 or later (64-bit)
macOS 10.13 or later
Suunto watches can be connected to SuuntoPlus Editor with USB or with Bluetooth. Connecting a Suunto watch with Bluetooth is supported in macOS and in Windows version 10 or later. Before trying to pair your Suunto watch as Bluetooth device you have to unpair the watch from Suunto mobile application (Android or iOS). In watch settings menu, go to Connectivity > Paired devices > MobileApp > Forget to unpair the watch.

Bluetooth support in SuuntoPlus Editor can be enabled or disabled with Enable Bluetooth setting in SuuntoPlus Editor extension settings.

To enable Bluetooth pairing in macOS, you also have to set at least a partial serial number of the watch to macOS Bluetooth Serial in SuuntoPlus Editor extension settings.

Watch displays
Different watch displays are identified by display ID that corresponds to display size and watch user interface version.

Note: SuuntoPlus is no longer maintained for UI1(s、m、l).

Display ID s
Small-sized display
218x218 pixels
UI version 1
Used in Suunto 3, Suunto 5 and Suunto 5 Peak
Display ID m
Medium-sized display
240x240 pixels
UI version 1
Used in Suunto 9 Peak
Display ID l
Large-sized display
320x300 pixels
UI version 1
Used in Suunto 9 and Suunto 9 Baro
Display ID n
Medium-sized display
240x240 pixels
UI version 2
Used in Suunto 9 Peak Pro
Display ID o
Medium plus sized display
280x280 pixels
UI version 2
Used in Suunto Vertical
Display ID q
Large-sized display
466x466 pixels
UI version 2
Used in Suunto Race, Suunto Race S, Race 2, Suunto Vertical 2, Suunto Ocean and Suunto Ocean Lite
SuuntoPlus sports app contents
Manifest file: manifest.json
Used for defining the name/author/etc. of the sports app
And for defining get/sub resources to be passed to the sports app logic (main.js)
And for defining output parameters to be eventually shown on the screen
As well as the used HTML templates
JavaScript file: main.js
Used for handling the main logic of the sports app and essentially relies on callback functions that are fired from the ESW
HTML user interface templates: some-template.html
Used for defining how and what data is shown on the screen
Manifest file
The manifest file manifest.json is a JSON file that describes the application and can have the following properties.

name
Type: String
Mandatory
Description: The name of the SuuntoPlus sports app is shown, e.g., in the SuuntoPlus selection list. Character limitation is 60 bytes but is also restricted by the UI width.
version
Type: String
Mandatory
Description: Version of the SuuntoPlus sports app, maximum length is 4 characters.
author
Type: String
Mandatory
Description: Defines the author of the SuuntoPlus sports app.
description
Type: String
Mandatory
Description: The description of the SuuntoPlus sports app is shown, e.g., in the app selection list below the app name. Character limitation is 100 bytes but is also restricted by the UI width.
type
Type: String
Mandatory
Description: Differentiates SuuntoPlus sports apps from SuuntoPlus guides. "device" for apps that use BLE device connection and "feature" for the rest.
usage
Type: String
Mandatory
Description: Not used at the moment, should be set to "workout".
modificationTime
Type: Integer
Mandatory
Description: Number, seconds since 1970
in
Type: Array of objects
Optional
Description: Defines the input resources for possible use in the main.js file. The objects have three parameters:
name: Name of the resource
source: The path of the resource
type: subscribe/get (Subscribe should work even if the resource just has a “get” end point but generally speaking one should try to use the proper one)
out
Type: Array of objects
Optional
Description: Defines the output resources which can be shown on the watch screen. Essentially used when something is calculated in main.js and that result would be something that one wants to show for the user.
name: Name of the variable
log: Set to true or “true” if the variable should be saved in the exercise data logs (Saving happens every time the sports app updates which means once per second). Note: A maximum of 5 variables can be logged currently.
shownName: This name will be used as the graph name in the Suunto mobile app
format: The value will be formatted based on the format chosen here before drawing the graph. See Advanced formatters for a list of supported formats.
inverted: Set to true or “true” if the graph of this variable should be drawn inverted
template
Type: Array of objects
Mandatory
Description: Defines the HTML templates used for showing the data.
A simple example of a manifest file:

{
  "name": "My sports app",
  "version": "1.0",
  "author": "Suunto",
  "description": "Running workout",
  "type": "feature",
  "usage": "workout",
  "modificationTime": 1234567890,
  "in": [
    { "name": "Duration", "source": "Activity/Move/-1/Duration/Current", "type": "subscribe" }
  ],
  "out": [
    { "name": "fibonacciValue" },
    { "name": "myVariable", "log": true, "shownName": "My Variable", "format": "Count_Threedigits" }
  ],
  "template": [
    { "name": "my-template-1.html" },
    { "name": "my-template-2.html" },
    { "name": "my-template-3.html" }
  ]
}
In: Native resources in the watch
These are the resources that are available in main.js as well as in the HTML templates. Note that adding a nonexistent path to manifest.json will result in the SuuntoPlus app not loading in the watch. Adding a nonexistent path to an HTML file will result in no data coming through. Currently 10 input resources can be included in any single SuuntoPlus app.

/Activity/{Window}/{WindowIndex}/{Parameter}/{Aggregate}
Type: Get/Subscribe

Gives a parameter's value for a given window, where:

{Parameter} - The chosen parameter
Duration
Distance
Speed
VerticalSpeed
HeartRate
HeartRatePercentage
Energy
Cadence
Strokes
StrokeRate
SwimmingStyle - not float
Swolf
Power
Altitude
Ascent
AscentTime
Descent
DescentTime
Temperature
RecoveryTime
DownhillGrade
{Window}
Move: Could be e.g., a triathlon race
Activity: Could be e.g., Swim, Cycling, Running...
Lap: Refers to a specific lap of the exercise
AutoLap: Refers to a specific autolap of the exercise
More might be covered in the future
{WindowIndex}: For example, for a “Lap” window, -2 would select previous lap's value for the given parameter
-1 Current
-2 Previous
-3 The one before that
...
{Aggregate}: Probably self explanatory
Current
Avg
Min
Max
Response:

Duration (seconds): Float
Distance (meters): Float
Speed (meters per second): Float
VerticalSpeed (meters per second): Float
HeartRate (Hz): Float
HeartRatePercentage (Percentage of maximum heartrate for given window): Float
Energy (Joules): Float
Cadence (Hz): Float
Strokes: Float
StrokeRate: Float
SwimmingStyle: Uint8
0 == Invalid
1 == Rest
2 == Butterfly
3 == Back
4 == Breast
5 == Free
6 == Drill
Swolf: Float
Power (Only 3s tail power value in watts): Float
Altitude (meters): Float
Ascent (meters): Float
AscentTime (seconds): Float
Descent (meters): Float
DescentTime (seconds): Float
Temperature (kelvins): Float
RecoveryTime (seconds): Float
DownhillGrade (Average downhill grade for given window): Float
For example:

/Activity/Activity/-1/Duration/Current - (Current activity duration)

/Activity/Lap/-2/Distance/Current - (Previous lap's distance)

Some resource combinations might not be available but they are generally easy to spot, e.g., “average duration” for a selected lap.

/Activity/Exercise/State
Type: Get/Subscribe

State of exercise

Response: Uint8

0 == Idle
1 == Started
2 == Paused
3 == Prestart
4 == Invalid
/Activity/SportMode/MoveActivityId
Type: Get

Current activity id for whole move,e.g. Triathlon / Multisport or the current ActivityId in case of single sports | Note: only get currently supported.

Response: Int32

/Activity/SportMode/Multisport
Type: Get/Subscribe

State of sport mode.

Response: Boolean

True == Sport mode on
False == Sport mode off
/Activity/SportMode/ActivityId
Type: Get / Subscibe

Current activity id.

Response: Object {ActivityIds}

ActivityIds.sportActivityId == Integer - Sport activity id
ActivityIds.groupActivityId == Integer - Group activity id
/Activity/ActivityTimer
Type: Get/Subscribe

Returns current count of milliseconds.

Response: Uint32

/Activity/ActivityTimer/State
Type: Get/Subscribe

State of timer

Response: Uint8

0 == Idle
1 == Running
2 == Paused
3 == Reset
4 == Invalid
/Activity/Current/Autopause
Type: Get/Subscribe

State of Autopause.

Response: Boolean

True == Autopause on
False == Autopause off
/Activity/Current/Speed
Type: Get/Subscribe

Speed based on fusion speed algorithm.

Response: Float

Speed in meters per second [m/s]
/Activity/Current/Distance
Type: Get/Subscribe

Distance based on fusion speed algorithm.

Response: Uint32

Distance in meters [m]
/Activity/Current/Cadence
Type: Get/Subscribe

Cadence based on fusion speed algorithm.

Response: Object {CadenceData}

CadenceData.source == Uint8
0 == Invalid
1 == Wrist
2 == Bikepod
3 == Footpod
4 == Powerpod
CadenceData.cadence == Float - Cadence [Hz]
/Activity/Current/Power1s
Type: Get/Subscribe

Only power value in watts.

Response: Uint16

/Activity/Current/Power3s
Type: Get/Subscribe

Only 3s tail power value in watts.

Response: Uint16

/Activity/Current/Power10s
Type: Get/Subscribe

Only 10s tail power value in watts.

Response: Uint16

/Activity/Current/Power30s
Type: Get/Subscribe

Only 30s tail power value in watts.

Response: Uint16

/Activity/Current/SwimOngoingLength
Type: Get/Subscribe

Gets currently ongoing pool length distance in meters.

Response: Float

/Activity/Current/SwimOngoingLength/Interval
Type: Get/Subscribe

Gets currently ongoing interval pool length distance in meters. Response: Float

/Activity/SwimmingStrokes
Type: Get/Subscribe

Gets total strokes for current lap

Response: Object {StrokeData}

StrokeData.delay == Float - Delay in seconds [s]
StrokeData.strokes == Uint16 - Total strokes
/Activity/SwimmingState
Type: Get/Subscribe

Gets swim state. Based on detection of repetitive acceleration patterns (strokes), at certain frequencies (realistic stroke rates). Pool lengths are detected by observing deviations in these patterns (turns), at certain frequencies.

Response: Uint8

0 == Idle
1 == Swimming
/Activity/SwimmingTurn
Type: Get/Subscribe

Gets data related to the previous swimming turn. Based on characterization of repetitive acceleration patterns (strokes).

Response: Object {TurnData}

TurnData.swimstyle == Uint8
0 == Invalid
1 == Rest
2 == Butterfly
3 == Back
4 == Breast
5 == Free
6 == Drill
TurnData.duration == Float - Duration in seconds [s]
TurnData.strokes == Uint8 - Total strokes used
TurnData.length == Float - Pool length in meters
/Activity/Feeling
Type: Get/Subscribe

Feeling of exercise

Response: Int32

0 == Undefined
1 == Poor
2 == Average
3 == Good
4 == Very good
5 == Excellent
/Activity/Log/Count
Type: Get/Subscribe

Number of logs

Response: Uint32

/Activity/TrainingLab/HeartRate
Type: Get/Subscribe

Get the latest heart rate in Hz.

Response: Object {HrDuration}

HrDuration.average == Float - Average heart rate in Hz
HrDuration.duration == Uint32 - Aggregate RR-interval in ms, 0 if no RR data
HrDuration.active == Boolean - True if activated, False if paused
/Activity/TrainingLab/Energy
Type: Get/Subscribe

Get the latest total energy consumption value in joule. Available only for ACTIVITY and TRIP_METER modes.

Response: Float

/Activity/Trigger
Type: Put

Manual lap trigger. Using 0 as input parameter here should be fine for most situations.

Parameter: Uint8

0 == Manual lap with popup and notification
23 == Silent lap, no lap view, no notification
24 == Invisible lap, no lap view, but has notification (vibration and, when enabled, tones)
25 == Muted lap, lap view pops up, but no notification of any kind
/Activity/Zones/{ZoneSet}/{Zone}/Limit
Type: Get/Subscribe

Get zone limit for a specific parameter

{ZoneSet}
Heartrate
Power
Speed
{Zone}
Invalid
Zone1
Zone2
Zone3
Zone4
Zone5
Lower
Current
Higher
Response: Float

/Hrv/Rmssd
Type: Get/Subscribe

Gets or subscribes to the latest HRV measurements.

Response: Object {HrvData}

timestampLocal: Uint32 - Local timestamp in seconds
rmssd: Uint32 - RMSSD in milliseconds
/Hrv/Rmssd/Short
Type: Subscribe

Subscribes to HRV measurements. If Short resource has been subscribed, HRV calculation window is 1 minute, otherwise it's 5 minutes. HRV calculation depends on pulse-to-pulse intervals from OHR data, no more than 30 % of the data can be missing from the calculation window.

Response: Same as /Hrv/Rmssd

/Dev/Time
Type: Get/Subscribe

Gets current time in number of seconds since epoch 1.1.1970 (UTC).

Response: Int64

/Dev/Time/LocalTime
Type: Get/Subscribe

Gets current local time in number of seconds since epoch 1.1.1970 (UTC) based on timezone.

Response: See above

/Dev/Time/LocalTime/WeekDay
Type: Get

Get current weekday.

Response: Int32

0 == ImperialSunday
1 == Monday
2 == Tuesday
3 == Wednesday
4 == Thursday
5 == Friday
6 == Saturday
7 == Sunday
/Dev/Time/LocalTime/Min
Type: Get/Subscribe

Gets current local time in number of seconds since epoch 1.1.1970 (UTC) based on timezone. Update interval is 1 min.

Response: Int64

/Device/Measurement/Temperature.Measurement
Type: Get/Subscribe

Temperature measurement in kelvins

Response: Float

/Fusion/Altitude
Type: Get/Subscribe

Get the last known altitude from sea level in meters.

Response: Float

/Fusion/Altitude/AltiBaroPressure
Type: Get/Subscribe

Get the last known AltiBaro pressure in pascals.

Response: Float

/Fusion/Altitude/PressureTrend
Type: Get/Subscribe

Get the sea level pressure trend indication.

Response: Uint8

0 == Unknown
1 == IncreaseAndIncrease
2 == IncreaseAndSteady
3 == IncreaseAndDecrease
4 == SteadyAndIncrease
5 == SteadyAndSteady
6 == SteadyAndDecrease
7 == DecreaseAndIncrease
8 == DecreaseAndSteady
9 == DecreaseAndDecrease
/Fusion/Altitude/Ascent
Type: Get/Subscribe

Get the last known ascent in meters.

Response: Float

/Fusion/Altitude/AscentTime
Type: Get/Subscribe

Get time used to ascent in seconds.

Response: Float

/Fusion/Altitude/Descent
Type: Get/Subscribe

Get the last known descent in meters.

Response: Float

/Fusion/Altitude/DescentTime
Type: Get/Subscribe

Get time used to descent in seconds.

Response: Float

/Fusion/Altitude/VerticalSpeed
Type: Get/Subscribe

Vertical speed based on fusion speed algorithm in meters per second.

Response: Float

/Fusion/Altitude/AscentDescentStart
Type: Get/Subscribe

Client can use this service for starting of ascent and descent calculation. This is both start from reset and restart after pause.

Response: Uint32

/Fusion/Altitude/AscentDescentStop
Type: Put

Client can use this service for stopping of ascent and descent calculation. This is both end of exercise and pause.

Response: Uint32

/Fusion/Altitude/AscentDescentReset
Type: Put

Client can use this service for resetting of ascent and descent counters.

Response: Uint32

/Fusion/Altitude/FusedAlti
Type: Get/Put/Subscribe

Get: The last known status of fused altitude

Put: Starts the altitude fusion with pressure sensor and GPS for max. 15 minutes. Stops the altitude fusion as soon as the fused altitude is found or not found in 15 minutes or with parameter value false, and restarts the altitude fusion with pressure sensor only.

Put: Boolean

True == Start
False == Stop
Response (Get): Uint8

0 == Inactive
1 == Activating
2 == Activated
3 == Failed
/Fusion/Altitude/OffsetChange
Type: Subscribe

Subscribe to get notifications about SealevelPressureOffset, AltitudeOffset and about new SealevelPressure and new Altitude.

Response: Object {fusionSeaLevel}

fusionSeaLevel.sealevelpressureoffset == Float - SealevelPressureOffset in pascals
fusionSeaLevel.altitudeoffset == Float - AltitudeOffset in meters
fusionSeaLevel.sealevelpressure == Float - New sealevelPressure in pascals
fusionSeaLevel.altitude == Float - New altitude in meters
/Fusion/Altitude/SeaLevelPressure
Type: Get/Subscribe

Get the current sea level reference pressure in pascals

Response: Float

/Fusion/Altitude/Data
Type: Get

Get two hours of data in array for graph

Response: Object {SampleSetSelector}

SampleSetSelector.count == Uint32 - Number of samples in output
SampleSetSelector.offset == Float - Start position of sample set data (default start of the sample data). Negative value indicates start from last data sample.
SampleSetSelector.offsetType == Uint8 - Reference point from where data is to be fetched (default Start)
0 == Start
1 == Current
2 == End
SampleSetSelector.type == Uint8 - Selector type (default duration)
0 == Sample
1 == Duration
2 == Distance
SampleSetSelector.length == Float - Length of the requested sample set (default rest of available data)
/Fusion/Location/GeoCoordinates
Type: Get/Subscribe

Get the last known coordinates (in WGS84 projection) from the location service. Example return value (60.27264, 24.97281, 16.00000). See: https://en.wikipedia.org/wiki/World_Geodetic_System

Response: Object {geoCoordinate}

geoCoordinate.latitude == int32 - Degrees multiplied by 10^7. Minimum value -900000000, Maximum value 900000000
geoCoordinate.longitude == int32 - Degrees multiplied by 10^7. Minimum value -1800000000, Maximum value 1800000000
geoCoordinate.altitude == float - Altitude in meters. Minimum value -20000, Maximum value 20000.
/Fusion/Location/Readiness
Type: Get/Subscribe

Get the readiness of the current location service in percentages.

Response: Uint8

/Navigation/Gps/Coordinates/{Filter}
Type: Get/Subscribe

Get the last known location coordinates as a string

{Filter}
Full
Grid
Row1
Row2
Response: String

/Navigation/Poi/Active/Distance
Type: Get/Subscribe

Get the distance to active POI (Point Of Interest)

Response: Uint32

/Navigation/Routes/NavigatedRoute/ETA
Type: Get/Subscribe

Estimated time of arrival to destination. Local time, seconds.

Response: Uint32

/Navigation/Routes/NavigatedRoute/ETE
Type: Get/Subscribe

Estimated time en route to destination, milliseconds

Response: Uint32

/Navigation/Routes/NavigatedRoute/DistanceToDestination
Type: Get/Subscribe

Return distance to end of route, meters

Response: Uint32

/Navigation/Routes/NavigatedRoute/Position
Type: Get/Subscribe

Return relative position on the route, negative when backward

Response: Float

/Navigation/Routes/NavigatedRoute/ClosestPoint
Type: Get/Subscribe

Return index of route point which is closest to current location

Response: Uint16

/Navigation/Routes/NavigatedRoute/MinAltitude
Type: Get

Return lowest altitude of the route

Response: Int16

/Navigation/Routes/NavigatedRoute/MaxAltitude
Type: Get

Return highest altitude of the route

Response: Int16

/Navigation/Routes/NavigatedRoute/RemainAscent
Type: Get/Subscribe

Return remaining ascent of route

Response: Uint16

/Navigation/Routes/NavigatedRoute/RemainDescent
Type: Get/Subscribe

Return remaining descent of route

Response: Uint16

/Navigation/Routes/NavigatedRoute/TotalAscent
Type: Get

Return total ascent of route

Response: Uint16

/Navigation/Routes/NavigatedRoute/TotalDescent
Type: Get

Return total descent of route

Response: Uint16

/Navigation/State
Type: Get/Subscribe

Get current navigation state

Response: Uint8

0 == Standby
1 == On POI
3 == On route
4 == On findback
5 == On locate
6 == On compass
7 == On snap
/Navigation/Targetlocation/Distance
Type: Get/Subscribe

Get the distance from the current location to given coordinates.

Parameters (Get): Location - Optional coordinates in WGS84 projection. If coordinates are not given, then location given in /Navigation/TargetLocation is used.

Object {Coordinate}
Coordinate.latitude == Int32 - Degrees multiplied by 10^7. Minimum value -900000000, Maximum value 900000000
Coordinate.longitude == Int32 - Degrees multiplied by 10^7. Minimum value -1800000000, Maximum value 1800000000
Response: Uint32

/Navigation/Targetlocation/Coordinates
Type: Get/Subscribe

Get the current target location coordinates as a string

Response: String

/Outdoor/StormAlarm/Status
Type: Get/Subscribe

Return whether storm alarm is on or off

Response: Boolean

/Outdoor/Sunrise/ETE
Type: Get/Subscribe

Get timespan to next sunrise in seconds. Error is returned if timespan is longer than 24h.

Response: Uint32

/Outdoor/Sunrise/Next
Type: Get/Subscribe

Get the next sunrise time in Unix time format

Response: Uint32

/Outdoor/Sunrise/Today
Type: Get/Subscribe

Get sunrise time for the current day in Unix time format

Response: Uint32

/Outdoor/Sunset/ETE
Type: Get/Subscribe

Get timespan to next sunset in seconds. Error is returned if timespan is longer than 24h.

Response: Uint32

/Outdoor/Sunset/Next
Type: Get/Subscribe

Get the next sunset time in Unix time format

Response: Uint32

/Outdoor/Sunset/Today
Type: Get/Subscribe

Get sunset time for the current day in Unix time format

Response: Uint32

/Settings/Activity/Current/ActivityID
Type: Get/Subscribe

Get ActivityID of the currently active activity

Response: Int32

/Settings/User/MaxHR
Type: Get

Get user max heart rate

Response: Uint8

/Settings/General/Language
Type: Get

Get the user's selected language

Response: Uint8

0 == Danish
1 == German
2 == English
3 == Spanish
4 == French
5 == Italian
6 == Dutch
7 == Norwegian
8 == Portuguese
9 == Finnish
10 == Swedish
11 == Chinese
12 == Japanese
13 == Korean
14 == Czech
15 == Polish
16 == Russian
17 == Thai
18 == Turkish
19 == Hebrew
20 == Greek
21 == Traditional Chinese
/Settings/Unit/UnitsMode
Type: Get

Get user unit mode (metric/imperial)

Response: Uint8

0 == Metric
1 == Imperial
/Settings/User/Gender
Type: Get

Get user gender

Response: Boolean

Female == false
Male == true
/Settings/User/BirthYear
Type: Get

Get user birth year

Response: Uint16

/Settings/User/Height
Type: Get

Get user height in meters

Response: Float

/Settings/User/Weight
Type: Get

Get user weight in kilograms

Response: Float

Out: Custom output resources
Custom output resources can be calculated in main.js JavaScript code and then passed on to the ESW. The custom resources are mapped to

Zapp/{zapp_index}/Output/myParameterNameInTheManifest

These resource paths can then be used within the html template and shown on the screen to the user. The {zapp_index} is provided by ESW. Currently 25 output resources can be included in any single SuuntoPlus app.

So suppose the manifest file would have the above defined “out” parameters “fibonacciValue” and “myVariable”. Then

Resource	Description
Zapp/{zapp_index}/Output/fibonacciValue	This resource will provide whatever value is assigned to output.fibonacciValue in the evaluate() function within main.js (see below / read on)
Zapp/{zapp_index}/Output/myVariable	This resource will provide whatever value is assigned to output.myVariable in the evaluate() function within main.js (see below / read on)
etc.	etc.
The main.js file
Syntax in main.js
All of the ES5 reserved words can be used in SuuntoPlus sports app JavaScript: break, do, instanceof, typeof, case, else, new, var, catch, finally, return, void, continue, for, switch, while, debugger, function, this, with, default, if, throw, delete, in, try

The following standard built-in objects are supported: Int8Array, Uint8Array, Float32Array

TypedArray note: It is likely that using typed arrays, some extra memory allocations are needed to keep track of byte length, array buffer offset, array buffer pointer etc. etc. E.g., just by defining a typed array an extra N bytes of memory allocations might be needed. Due to this, if typed arrays are needed for, e.g., saving memory, it's probably best idea to define just one single large buffer and use that instead of using lots of small typed array buffers.

E.g.,

// Not good. Used memory is 2*128 + 2*26 == 256 + 2*N bytes
var buffer_0 = new Uint8Array(128);
var buffer_1 = new Uint8Array(128);

// Good
var buffer = new Uint8Array(256); // Used memory is 2*128 + N == 256 + N bytes
Also the following identifiers can be used:
Infinity, NaN, undefined

The following standard built-in objects are not supported:
Date

How to work with main.js
The whole SuuntoPlus sports app system relies on callback functions (events). These callback functions are fired from ESW in certain situations. Within these callback functions in the main.js file, different calculations can be done, and then results can be sent back to ESW and finally shown on the screen. On top of the callback functions the developer has access to a collection of native functions which can be used to refresh the watch screen, open popup window, etc.

Also, important to note that a function defined as

function helloWorld() {
  // Some functionality
}
will be defined in the global scope and those are reserved for ESW.

For defining local custom functions, use the following format:

var helloWorld = function() {
  // Some functionality
}
Note: Also, something to keep in mind is that some syntax errors in main.js might go through the minifier but are not interpreted properly by ESW. In these cases one would generally see just a black screen / some error notification instead of the SuuntoPlus sports app screen.

Lifecycle of main.js
Many of the callback functions are self explanatory but here's a brief list on when the callback functions are executed. See also list of event callback function below.

SuuntoPlus sports app is selected from the watch menu
onLoad() is executed
evaluate() starts running and triggers about once per second (Note: this happens before the exercise has been started!)
Exercise is started
onExerciseStart() is executed
User enters SuuntoPlus sports app screen
getUserInterface() is executed
User pauses exercise
onExercisePause() is executed
User stops the exercise
onExerciseEnd() is executed
getSummaryOutputs()
SuuntoPlus sports app events
The following table lists callback functions that can be used within the main.js file. The red rows are to be defined later.

Input parameters for all functions:

input
type
Object
Description
Holds the resources the watch passes to main.js. Note that some resources have not been subscribed in onLoad function, because exercise hasn't started yet.
output
type
Object
Description
Holds the resources the main.js passes to the watch (which can then be shown on the screen)
onLoad(input, output)
Return value: -

Is evaluated during the loading of the SuuntoPlus sports app. Note: This happens when actually selecting the SuuntoPlus sports app from the menu (and thus also before exercise start).

Example:

var lapCounter, autoLapCounter, fibPrev, fibNext, myVar, isPaused;
function onLoad(input, output) {
  // main.js loaded here and evaluate() starts running
  lapCounter = 0;
  autoLapCounter = 0;
  myVar = 2;
  isPaused = 1;
}
onExerciseStart(input, output)
Return value: -

Is evaluated on exercise start. A good place to initialize variables to some value for example.

Example:

function onExerciseStart(input, output) {
  fibPrev = 0;
  fibNext = 1;
  isPaused = 0;
}
evaluate(input, output)
Return value: -

Is evaluated every 1 second (+/- 0.005 seconds error). Note: This function starts running after onLoad().

Example:

function evaluate(input, output) {
  if (isPaused) return;

  // Using the above defined manifest.js
  output.myVariable = myVar * input.Duration;
  output.fibonacciValue = fibPrev + fibNext;
  if (fibPrev + 2*fibNext < 9999) {
    // Stop incrementing once we go over 4 digits
    fibPrev = fibNext;
    fibNext = output.fibonacciValue;
  }
}
onLap(input, output)
Return value: -

Is evaluated every lap change

Example:

function onLap(input, output) {
  ++lapCounter;
  // reset fibonacci
  fibPrev = 0;
  fibNext = 1;
}
onAutoLap(input, output)
Return value: -

Is evaluated every autolap change

Example:

function onAutoLap(input, output) {
  ++autoLapCounter;
}
onEvent(input, output, eventId)
Return value: -

Event that can be triggered from HTML to main.js

Example:

HTML:

<!-- Override lap button in the sports app view -->
<userInput>
  <pushButton name="up" onClick="$.put('/Zapp/{zapp_index}/Event', 42, null, 'int32');""/>
  <pushButton name="down" longType="lock" onClick="$.put('/Zapp/{zapp_index}/Event', 123, null, 'int32');" />
</userInput>
main.js:

function onEvent(input, output, eventId) {
  if (eventId == 42) {
    // Up button was pressed
  }
  else if (eventId == 123) {
    // Down button was pressed
  }
  // You could also override the long button presses in the .html file
  // by replacing the onLongPressStart with your own functionality, like
  // onLongPressStart="$.put('/Zapp/{zapp_index}/Event', 1, null, 'int32');"
}
onAccelerometer(input, output)
Return value: -

Callback function to receive accelerometer data. This function is called every time the accelerometer sensor has buffered 25 samples (every ~0.5 seconds). You must add Fusion/Zapp/Accelerometer resource to manifest in order to receive data.

manifest.json:

{ "name": "acc", "source": "Fusion/Zapp/Accelerometer", "type": "subscribe" }
mmain.js:

function onAccelerometer(input, output) {
  // input.acc.time == timestamp of the first sample in the batch. The samples are separated by 0.02 seconds (50Hz).
  // input.acc.x == array of length 25
  // input.acc.y == array of length 25
  // input.acc.z == array of length 25

  // All the input and output resources are usable here
  // However, "acc" is only usable within this callback

  // While output resources can be updated here, ESW is notified of the updates only after evaluate callback. This
  // means you won't see the value updating on the screen after this callback but only after evaluate is executed
  // the next time.

  // For example:
  var max_x = -999;
  for (var i = 0; i < input.acc.x.length; ++i) {
    if (input.acc.x[i] > max_x) {
      max_x = input.acc.x[i];
    }
  }
  output.myMaxValue = max_x;
}
onExercisePause(input, output)
Return value: -

Is evaluated on exercise pause. A good helper to prevent evaluate() from doing anything while the exercise is paused.

Example:

function onExercisePause(input, output) {
  isPaused = 1;
}
onExerciseContinue(input, output)
Return value: -

Is evaluated when continuing exercise after pause. A good helper to prevent evaluate() from doing anything while the exercise is paused.

Example:

function onExerciseContinue(input, output) {
  isPaused = 0;
}
onExerciseEnd(input, output)
Return value: -

Is evaluated right before the sports app is removed from memory.

getUserInterface(input, output)
Return value: An object with a template parameter (string) which is the html template's name that the developer wants to show on the screen

Is evaluated when a user enters the SuuntoPlus sports app screen the first time and when the screen is reloaded. Essentially defines what is shown on the screen by returning the wanted template. **Note:**this function must exist in order for the SuuntoPlus sports app to work.

Example:

function getUserInterface(input, output) {
  return {
    template: 'my-template'
  };
}
getSummaryOutputs(input, output)
Return value: An array of objects defining the shown fields/titles. An object consists of:

id: Unique id
name: Field name
format: Field format
value: The shown value
postfix: Optional postfix / unit, if not specified by formatter
Defines the SuuntoPlus sports app related info shown at the bottom of the summary info after ending the exercise. These values are also provided to Suunto app (mobile application). More about the logs in the “Data logging” section.

Example:

function getSummaryOutputs(input, output) {
  return [
    {
      id: 'fibonacciValue',
      name: 'Fibonacci value',
      format: 'Count_Fourdigits', // More about output formats in "html" section
      value: output.fibonacciValue
    }
  ];
}
Native functions
The following sections list some of the native functions that can be called from main.js or from JavaScript in HTML files.

evalFile(fileName)
Arguments:

fileName
Type: String
Description: A file to be evaluated and loaded to variable.
Return value: Depends on the input file. For example Array or Object.

This function can only be called from main.js. Loads a file and evaluates it to for example an array or an object which can then be saved to a variable. Can be used to save memory by loading files/parameters from disk to memory only when needed. Note: File name must start with "ext".

Example:

// Suppose ext0.js contains only the following line
// { a: 123, b: "Hello" }
var someObject, index;
function onLoad() {
  index = 0;
}
function evaluate() {
  someObject = undefined; // This guarantees memory release during evalFile
  someObject = evalFile("{file_path}/ext" + index + ".js");
  // Now someObject.a == 123 and someObject.b == "Hello"
}
unload(view)
Arguments:

view
Type: String
Description: A view name to be unloaded
Return value: -

Unloads a view and then refreshes the view and sub views. Can be used to update screen with a new html template for example.

Example:

var currentTemplate;

function onLoad() {
  currentTemplate = 'tmpl';
}

function onLap() {
  currentTemplate = 'tmpl2';
  unload("_cm"); // Unload & reload the screen to rerun getUserInterface
}

function getUserInterface() {
  return {
    template: currentTemplate
  };
}
Currently, "_cm" is fixed syntax and the only one of its kind — it represents the SuuntoPlus view page.

playIndication(name, btn, prio, stop)
Arguments:

sound
Type: String
Description: Sound name to be played: 'Button', 'Confirm', 'Info', 'Interval', 'StartTimer', 'StopTimer'
btn
Type: Boolean
Description: True if the indication is button related (false by default)
prio
Values: 0 == low, 1 == medium (default), 2 == high
Description: Whether the sound will override already playing sounds or not
stop
Type: Boolean
Description: True if the sound should be stopped (false by default). Set this to true to stop or cancel an already playing sound.
Return value: -

Plays or stops a selected sound. Vibration is included if it's enabled in watch settings.

Example:

var finished;
function onLoad() {
  finished = 0;
}
function evaluate(input, output) {
  if (isPaused) return;
  output.myVariable = myVar;
  output.fibonacciValue = fibPrev + fibNext;
  if (fibPrev + 2 * fibNext < 9999) {
    // Stop incrementing once we go over 4 digits
    fibPrev = fibNext;
    fibNext = output.fibonacciValue;
  }
  else if (!finished) {
    playIndication("Interval"); // Play sound once we reach the max value
    finished = 1;
  }
}
setText(id, text)
Arguments:

id
Type: String
Description: Html element id
text
Type: String
Description: String to insert to the element
Return value: -

Changes html element's text content, but only when the HTML in question is visible, and the element has text content in it to change. Spaces do not count as content.

Example:

var swapper;
function onLoad() {
  swapper = 1;
}
function evaluate(input, output) {
  if (isPaused) return;

  // Suppose the html has an element like <div id="someIdHere">-</div>
  // Change html element's text every time evaluate is executed
  if (swapper > 0) setText("#someIdHere", "Hello");
  else setText("#someIdHere", "World");
  swapper *= -1;
}
control(target, command)
Controls the element to perform the corresponding action.

Arguments:

target
Type: String
Description: target element selector
command
Type: string
Description: name of the command, e.g. Currently there is only one operation: 'REFRESH'
'REFRESH': Refreshes the element.
Return value: -

Sends a control signal to element(s)

Example:

onActivate="
  control('eval', 'REFRESH')
"

<eval input="/Activity/Move/-1/Distance/Current" outputFormat="Distance_Fourdigits" default="--" />
 onActivate="
  control('#refresh-canvas', 'REFRESH')
"

<object id="refresh-canvas" type="canvas" style="width:100%; height:100%;" build="ctx => gauge(ctx);" />
 onActivate="
  control('#refresh-graph', 'REFRESH');
"

<graph id="refresh-graph" style="position:absolute;
  left:0px; top:0px; width:100%; height:100%;
  box-sizing: border-box;
  padding-right:90px; padding-top:50px; padding-bottom:50px;
  font-size:21px;
  fill-color:rgba(255, 50, 255, 0.7);"
  valueFormat="HeartRate_Fourdigits"
  type="bar"
  grid="three lines"
  inputType="get compilation"
  input="Activity/Log/-1/Move/0/HeartRate/Avg/Data"
  min="0.6666666667"
  max="3"
  slack="0.1" />
getStyle(target, propertyName[, calculateValue=false])
Gets the value of a CSS property.

Return value: string

Example:

<uiView onActivate="
  $.subscribe('/Activity/Current/Speed', function(v) {
    var speedPerHour = v * 3.6;
    // Green for excellent running speed, gray for good, red for slow.
    var c = getStyle(speedPerHour > 10 ? 'css:.c-green' :
                    (speedPerHour >= 8 ? 'css:.cm-mid'  : 'css:.c-red'), 'color');
    // Change background color
    setStyle('#background', 'background-color', c);
  });
">
  <div id="background">
    <div style="top:calc(50% - 50%e);left:calc(50% - 50%e);">
      <span class="sp-d-s f-num">
        <eval input="/Activity/Current/Speed" outputFormat="Speed_Threedigits" default="--" />
      </span>
      <span optional class="sp-t-s">
        <postfix />
      </span>
    </div>
  </div>
</uiView>
setStyle(target, propertyName, propertyValueExpression)
Sets the value of a CSS property.

Return value: -

Example:

<userInput>
  <pushButton name="next" onClick="setStyle('#feedback *', 'visibility', 'VISIBLE')" />
</userInput>
<div id="feedback" class="sp-b-m" style="left:calc(50% - 50%e); top:calc(50% - 50%e); visibility:hidden">
  Feedback, wow!
</div>
navigate(target, index[, immediate=false[, relative=false]])
Sends 'navigate' command to the target element with the index argument. Index can be integer, or item id as string (currently supported by viewset and menu).

Example:

Use 'up' and 'down' buttons to navigate forward and backward in viewset
'next' button will always navigate to item B
'upleft' button will always navigate to item C immediately without animating
<uiView>
  <userInput>
    <pushButton name="up" onClick="previous('uiViewSet')" />
    <pushButton name="next" onClick="navigate('uiViewSet', 1)" />
    <pushButton name="down" onClick="next('uiViewSet')" />
    <pushButton name="upleft" onClick="navigate('uiViewSet', 'itemC', true)" />
  </userInput>
  <uiViewSet style="position:absolute; width:100%; height:100%">
    <div>A</div>
    <div>B</div>
    <div id="itemC">C</div>
    <div>D</div>
  </uiViewSet>
</uiView>
next(target)
Sends 'next' command to the target element.

previous(target)
Sends 'previous' command to the target element.

first(target)
Sends 'first' command to the target element.

last(target)
Sends 'last' command to the target element.

sportAppActivityEvent(activityId)
Arguments:

activityId
Type: Int32
Description: the activity ID (3 == running)
Enables multisport and changes current activity to the given activity Id.

Example:

sportAppActivityEvent(3)  // Switch to Running
$.subscribe(path[, function])
Arguments:

resourcePath
Type: String
Description: Path for the resource
Return value: returns token which is used to unsubscribe.

$.subscribe can be used to subscribe to resources for example in onActivate of uiView element.
the subscription can be released later with $.unsubscribe, or left to be unsubscribed automatically after view is deactivated (after onDeactivate)
never subscribe in onLoad, since there is no onUnload
in case the resource returns HTTP_CODE_NO_CONTENT, the event handler function is not executed
Subscribe example:

<uiView id="my_view"
  onLoad="
    var previousValue = undefined;
    var subscriptionToken;"
  onActivate="
    subscriptionToken = $.subscribe('/Dev/Value', function(newValue) {
      if (newValue !== previousValue) {
        if (previousValue === 4 && newValue === 7) {
          open('new_view');
          close('my_view');
        }
        previousValue = newValue;
      }
    });"
  onDeactivate="$.unsubscribe(subscriptionToken);"
>
$.unsubscribe(token)

The returned subscriptionToken can be used to unsubscribe by

$.unsubscribe(subscriptionToken);
$.put(resourcePath, param, [optional function callback], [optional type specifier])
Arguments:

resourcePath
Type: String
Description: Path for the resource
param
Type: Depends on the path
Description: Resource put parameter
type specifier
Type: String
Supported types: bool, int8, uint8 (default), int16, uint16, int32, uint32, int64, uint64, float, double, string
If non default (uint8) type specifier is needed, callback function can be set to null.
Return value: -

Put request to a resource. Note: Same kind of syntax works for “get” request, e.g., “$.get(path, callbackFunction)” where the “callbackFunction” would be fired once the async get request is finished. Generally, however, one should use the manifest file for setting up these in the main.js context at least.

Example:

var finished;
function onLoad() {
  finished = 0;
}
function evaluate(input, output) {
  if (isPaused) return;
  output.myVariable = myVar;
  output.fibonacciValue = fibPrev + fibNext;
  if (fibPrev + 2 * fibNext < 9999) {
    // Stop incrementing once we go over 4 digits
    fibPrev = fibNext;
    fibNext = output.fibonacciValue;
  }
  else if (!finished) {
    $.put("/Activity/Trigger", 0); // Trigger lap once we reach the max value
    finished = 1;
  }
}
Lap types
Essentially there is four different types of laps that can be triggered.

First, normal lap, with lap view, vibration and tone (if tones are enabled):

$.put("/Activity/Trigger", 0);
Then three other types with different qualities:

$.put('Activity/Trigger', 23); // silent lap, no lap view, no notification
$.put('Activity/Trigger', 24); // invisible lap, no lap view, but has notification (vibration and, when enabled, tones)
$.put('Activity/Trigger', 25); // muted lap, lap view pops up, but no notification of any kind
Compile time tokens
The following compile tokens are available in main.js and in HTML:

DISPLAY_ID: Replaced with display ID, q, l etc.
HAS_ON_EVENT: Replaced with 1 if watch supports onEvent callback function, otherwise with 0
HAS_SILENT_LAP: Replaced with 1 if watch supports lap types 23, 24 and 25, otherwise with 0
HAS_SETTINGS: Replaced with 1 if watch supports settings, otherwise with 0
IS_UI1: Replaced with 1 if UI version 1, otherwise with 0
IS_UI2: Replaced with 1 if UI version 2, otherwise with 0
LANGUAGE: Replaced with language code, e.g. en
For example, display specific JavaScript code can be executed in main.js using DISPLAY_ID token which is replaced with display ID of the watch when SuuntoPlus app is compiled:

if ('{{ DISPLAY_ID }}' == 'l') {
  // This code is executed if display is l
}
else {
  // This code is executed if display is not l
}
In HTML:

<:if test="{{ HAS_ON_EVENT }}">
  <userInput>
    <!-- Calls main.js onEvent callback function with eventId value 1 -->
    <pushButton name="down" onClick="$.put('/Zapp/{zapp_index}/Event', 1, null, 'int32');" />
  </userInput>
</:if>
HTML templates
The HTML templates define how and what data are shown on the watch. It's recommended to use the predefined HTML templates and examples, and to use the same HTML for all watch displays (s, m, n, l, o, q etc.). You can also have different HTML templates for different displays if display specific user interfaces are required.

Single HTML template	Display specific HTML templates
manifest.json { "name": "My sport app", "version": "1.0", "author": "Suunto", "description": "My sport app", "template": [ { "name": "tmpl.html" } ] }	manifest.json {"name": "My sport app","version": "1.0","author": "Suunto","description": "My sport app","type": "device","usage": "workout","modificationTime": 1634700000,"template": [{ "name": tmpl-l.html", "displays": ["l"] },{ "name": "tmpl-m.html", "displays": ["m"] },{ "name": "tmpl-n.html", "displays": ["n"] },{ "name": tmpl-s.html", "displays": ["s"] },{ "name": "tmpl-o.html", "displays": ["o"] },{ "name": "tmpl-q.html", "displays": ["q"] }]}
main.js function getUserInterface(input, output) { return { template: 'tmpl' }; }	main.js function getUserInterface(input, output) { // ESW inserts s/m/l/n/o/q to {zapp\_disp} depending on screen size and UI version \n return { template: 'tmpl-{zapp_disp}' }; }
Standard HTML elements
div
non-standard optional attribute can be used to optimize away elements without content:
<div optional> some content, not optimized away </div>
<div optional> <!-- no content so gets optimized away --> </div>
span
non-standard optional attribute can be used to optimize away elements without content:
<span optional> some content, not optimized away </span>
<span optional> <!-- no content so gets optimized away --> </span>
img
The <img> element is used to embed an image. The only supported image format is PNG and maximum number of colours is 64. Image must also be listed in manifest. Maximum number of images per SuuntoPlus app is two.

Support attributes: class, id, src, style

Embedded image can be an alpha-only image where only alpha channel is used from the image and colour of the image can be set with CSS. Alpha-only image is indicated in manifest using "type": "a64" file extension. This example adds an alpha-only image and sets its colour to red:

HTML file:

<img src="my-icon.png" style="top:calc(53% - 50%e);left:calc(20% - 50%e);color:red;"/>
manifest.json:

"image": [
  { "name": "my-icon.png", "type": "a64" }
]
Non-standard HTML elements
eval
The <eval> element is replaced by a value from the input parameter. Supported attributes:

input: The resource path
outputFormat: Format in which the input parameter is formatted in watch display
default: Default value if no valid values have come in
onValueChanged: Can be used to, e.g., run JavaScript function every time the "input" value changes
Supported formatters in eval element, see also Advanced formatters for a list of supported advanced formats:

Formatter	Description
auto	Tries to detect the data type and format some kind of text out of it
time / duration	Formats the output based on token combinations
timediff	Formats the output based on token combinations
keyValue	Maps a numeric value to string, for example: <eval input="/Settings/Unit/UnitsMode" outputFormat="keyValue 0=Metric!|1=Imperial!" />
script	Passes the value to a script and shows the return value on the screen. For example: <eval input="/Activity/Move/-1/Distance/Current" outputFormat="script x => 2*x" /> or <uiView onLoad=" function parseDuration(d) { return (d < 12 ? d : 'More than 12 seconds gone!'); } "> <div class="f-m f-num" style="top:80px;left:75px;width:205px;text-align:center;"> <eval input="/Activity/Move/-1/Duration/Current" outputFormat="script x => parseDuration(x)" default="--" /> </div> </uiView> or <eval input="Zapp/{zapp_index}/Output/timeInSecs" outputFormat="script x => (x < 0 ? '-' : '') + formatValue(Math.abs(x), 'time mm\'ss')" />
Note about the native post formatting

The resource endpoints only understand SI units. However, the UI (essentially the element) will convert the received values from metric to imperial, if that option is set for the user, based on the outputFormat. E.g., if a user has imperial unit system set, then “<eval input="/Activity/Move/-1/Distance/Current" outputFormat="Distance_Fourdigits" default="--" />" the input resource outputs distance in meters but outputFormat option “Distance_Fourdigits” converts the units from metric system to imperial system. One could, however, get the used unit format from the watch and then create any other output format to a parameter if needed using the script format for example (or by outputting some custom variable from main.js).

Note that the unit systems are mapped in the following way as enumeration values in the /Settings/Unit/UnitsMode resource.

0 → Metric
1 → Imperial

postfix
Place the postfix element inside the same container element with the eval element. Postfix is searched forward in DOM tree within the eval element's parent's parent, and has to appear before any other eval element. Postfix element will be replaced with output unit based on eval element's formatter, see Advanced formatters for a list of supported formats.

<div style="top:calc(64% - 50%e);left:calc(74% - 50%e);">
  <span class="sp-d-s f-num">
    <eval input="/Activity/Move/-1/Duration/Current" outputFormat="Duration_Training" default="--" />
  </span>
  <span optional class="sp-t-s">
    <postfix />
  </span>
</div>
canvas
Similar to standard HTML canvas element, but only part of the functionality is supported. The following functions and properties are supported in the context object:

width: width of the canvas element in pixels
height: height of the canvas element in pixels
beginPath
closePath
moveTo
lineTo
stroke
fill
fillRect
fillText
measureText
arc
arcTo
rotate
translate
scale
setTransform: Please note transform is not supported
lineWidth
strokeStyle: Please note color names don't work with strokeStyle or fillStyle, but only hexadecimal formats ("#FFF"=rgb "#FFFF"=argb "#FFFFFF"=rgb "#FFFFFFFF"=argb)
fillStyle
lineCap
font
REFRESH signal can be sent to the element to force rebuilding, for example: setTimeout(function(){control('#cnv','REFRESH')}, 1000)

Canvas example for drawing a chart:



<uiView onLoad="
  var duration = [0, 39, 73, 22, 8];
  var color = ['#7B2820', '#7B4C18', '#FFDE31', '#397D39', '#18717B'];
  var bgColor = '#525552';

  function doBuild(ctx) {
    ctx.font = '25px monospace numbers';
    ctx.lineWidth = 16;

    var totalDuration = 0;
    for (var i in duration) totalDuration += duration[i];
    if (totalDuration < 1) totalDuration = 1;

    var barLeft = ctx.width * 0.4, barWidth = ctx.width - barLeft - ctx.lineWidth / 2;

    ctx.lineCap = 'round';
    ctx.strokeStyle = bgColor;
    ctx.beginPath();
    for (var i = 0; i < duration.length; i++) {
      var y = i * ctx.height / duration.length + 20;
      ctx.moveTo(barLeft, y);
      ctx.lineTo(barLeft + barWidth, y);
    }
    ctx.stroke();

    for (var i = 0; i < duration.length; i++) {
      ctx.strokeStyle = color[i];
      var y = i * ctx.height / duration.length + 20;
      ctx.beginPath();
      ctx.moveTo(barLeft, y);
      ctx.lineTo(barLeft + barWidth * duration[i] / totalDuration, y);
      ctx.stroke();

      ctx.fillStyle = duration[i] ? '#FFF' : bgColor;
      var text = formatValue(duration[i], 'time mm\'ss');
      ctx.fillText(text, 0, i * ctx.height / duration.length);
    }
  }
  ">

  <object type="canvas"
          build="ctx => doBuild(ctx)"
          style="position:absolute; left: 13%; width: 65%; top: 30%; height: 170px;" />
</uiView>
graph
Graph element visualizes data as different kinds of charts. There are three kinds of input types:

get compilation: Get operation is used to fetch a sample set. Used for example in summary to show data of the exercise.
get value: Iterate watch resources to collect samples by getting one by one.
subscribe (default): Live data is subscribed and compiled to graph on the fly.
  <uiView>
    <!-- Average heart rate data graph for previous exercise -->
    <div id="suuntoplus">
      <graph style="position:absolute;
                    left:0px; top:0px; width:100%; height:100%;
                    box-sizing: border-box;
                    padding-right:90px; padding-top:50px; padding-bottom:50px;
                    font-size:21px;
                    fill-color:rgba(255, 50, 255, 0.7);"
            valueFormat="HeartRate_Fourdigits"
            type="bar"
            grid="three lines"
            inputType="get compilation"
            input="Activity/Log/-1/Move/0/HeartRate/Avg/Data"
            min="0.6666666667"
            max="3"
            slack="0.1" />
    </div>
  </uiView>
:if, :elseif, :else
Checks the value of test and discards the contents of the block if the value is 0. Requires spaces on calculations; ( 2 + 3 ) * 4

Example:

<uiView>
  <:if test="1">
    <div> This div is seen by the html loader </div>
  </:if>
  <:else>
    <div> ... but this is not </div>
  </:else>

  <:if test="0">
    <div> This div is not seen by the html loader </div>
  </:if>
  <:elseif test="1">
    <div> ... but this is </div>
  </:elseif>
</uiView>
Examples using runtime tokens, requires spaces also:

   <:if test="{DEVICE_HAS_CHINESE}"> Has chinese! </:if>
   <:if test="! {ACT_POD_POWER}"> Power sensor not included in workout! </:if> // Note space after exclamation mark, necessary
   <:if test="{DEVICE_BUTTON_COUNT} >= 5"> Has at least five buttons! </:if>
uiViewSet
defines a set of elements of which only one (or none) is shown at a time

child elements are div:s, and always fill full content area of the viewset

use class "selected" to indicate the default child element

shown element can be changed by scripting functions such as next, previous, first and last, or by panning if viewset is pannable

viewset is pannable if orientation is defined, and panning is not explicitly disabled by pannable="false"

for pannable viewset the flick events (matching viewset orientation) are not executed when flicked, but instead when You pan over the last/first page far enough and let go

<uiViewSet id="vs"
  orientation ="horizontal"
  transition.type ="slide"
  transition.timing ="ease"
  transition.duration ="0.5"
  rollOver ="none"
  onTap ="setDisplayBrightness( undefined, 'switch-on-off' )">

  <div> first </div>
  <div> second </div>
  <div class="selected"> third and default </div>
</uiViewSet>
events
In addition to typical events (onTap etc.), following events can be used with uiViewSet element:

onWakeUp: called when activity such as panning or animating is started

onIdle: called after animation ends (for example after panning) (note: fired only if transition.duration > 0)

onSelectionChanged: called whenever currently selected view changes Each event is fired with parameters:

target: ID of target element

targetData: index of target element 0..N

For example if third view is currently selected, and user pans enough to change view to second view, the event sequence is:

onWakeUp targetData=2 target=ID-OF-THIRD-VIEW-DIV

onSelectionChanged targetData=1 target=ID-OF-SECOND-VIEW-DIV

onIdle targetData=1 target=ID-OF-SECOND-VIEW-DIV

userInput
list of input methods which are not bound to any ui element (such as pushButton)
pushButton
defines events for single mechanical push button

should be always inside userInput tag

example:

button names: up, next, down, upleft, downleft

attributes type and longType: possibility to define event type for click (type) and long presses (longType)..

normal (default): button lock mode LOCK_ACTIONS does not block

action: button lock blocks always the event

lock: button lock does not block the event.. if no event handler defined, default button lock controlling is used. Basically this means that:

<pushButton name="down" longType="lock" longPressDuration="1" />

EQUALS:

<pushButton name="down" longType="lock" longPressDuration="1" onButtonEvent="
  lgPopup( targetData, 'popup', '{TXT_LOCKING}','{TXT_LOCKED}','a-unlock.png','a-lock.png',
          '{TXT_UNLOCKING}','{TXT_UNLOCKED}','a-lock.png','a-unlock.png')" />
when button is pressed while input lock is enabled, system tries to show #popup element to with {TXT_LOCKED} text and "a-lock.png", and hides #popup_progress element

If amoled display was off at the button press-down, the possible onClick action is disabled by default. Such click events can be enabled with attribute enabledWhileDisplayOff.

Example for exercise data screen view:

    <pushButton name="up" enabledWhileDisplayOff onClick="pause();"/>
If amoled display was in always-on-display state at the button press-down, the possible onClick event can be disabled with attribute disabledWhileAOD.
Example for exercise route view:

    <pushButton name="next" disabledWhileAOD onClick=" ... "/>
The attributes enabledWhileDisplayOff and disabledWhileAOD are aliases for getIsEnabled=”true” and getIsEnabled=”false”, respectively. If getIsEnabled is left undefined, the default behavior occurs.
Example for exercise data screen view:

    <!-- If exercise running, enable down click (lap) even if display was off -->
    <!-- If paused, leave getIsEnabled undefined (default behavior) -->
    <pushButton name="down" getIsEnabled="oldExSt == 1 ? true : undefined" onClick=" ... "/>
events
onClick

button was clicked. Click is a button press of max 0.6 s in length.
onLongPress

button released, longPressDuration was reached
onLongPressCancel

button released, longPressDuration was not reached
onLongPressStart

long press started. After button has been held for 0.6 s.
onLongPressFull

button still pressed, longPressDuration reached
longPressDuration

minimum duration in seconds (is stored only once per button per document). Must be over 0.6 s. Default is 2 s.
onButtonEvent( target, targetData )

common button event handler executed just before specific event handler
targetData values:
0: LONG_START
1: LONG_CANCEL
2: LONG_FULL
3: LONG_PRESS
4: CLICK
5: FLICK_UP
6: FLICK_RIGHT
7: FLICK_DOWN
8: FLICK_LEFT
9: TWO_FINGER_TAP
10: DOUBLE_TAP
example:

<userInput>
  <pushButton name="up" longPressDuration="5"
    onClick="systemEvent('up button click');"
    onLongPressStart="systemEvent('up button long press start');" 
    onLongPressCancel="systemEvent('up button long press cancel');"
    onLongPressFull="systemEvent('up button long press full');"
    onLongPress="systemEvent('up button long press');"/>
</userInput>
CSS
Watch UI versions 1 and 2 have different set of CSS classes. Only common CSS classes should be used for display independent HTML templates. If SuuntoPlus app has separate HTML template for each display, also UI version specific CSS classes can be used.

Note: The older watches do not support every possible font size and thus using the css classes for font sizes (shown below) can generally lead to less errors. If a font size isn't supported, the watch shows the letters most likely as squares.

Common CSS classes for all UI versions:

p-m: Center the element vertically and horizontally in the watch display
p-hc: Center the element horizontally in the watch display
sp-vertical-center: Center child elements vertically
sp-text-bottom: Aligns text baseline in child elements
sp-scale-display: Transforms CSS top property for unsymmetrical l display: top coordinates in per cents will be increased by 320/300. For example style="top:calc(50%);" is transformed to style="top:calc(53%);" for l display.
f-num: Monospace font for data fields
cm-fg: Black text and white background, vice versa in light theme
cm-bg: White text and black background, vice versa in light theme
cm-mid: Grey foreground color, theme dependent
f-ico, f-ico-m, f-ico-l: Icon font classes
sp-c-blue: Foreground color, blue
sp-c-cyan: Foreground color, cyan
sp-c-green: Foreground color, green
sp-c-orange: Foreground color, orange
sp-c-purple: Foreground color, purple
sp-c-red: Foreground color, red
sp-c-yellow: Foreground color, yellow
sp-bc-blue: Background color, blue
sp-bc-cyan: Background color, cyan
sp-bc-green Background color, green
sp-bc-orange: Background color, orange
sp-bc-purple: Background color, purple
sp-bc-red: Background color, red
sp-bc-yellow: Background color, yellow
sp-title-bg: Application title background
sp-title-text: Application title text
Common CSS classes for text, these are mapped to UI version specific classes:

sp-d-xxl: f-xxl in UI 1, f-d-xxl in UI 2, f-d-xxxl in UI 2 large display
sp-d-xl: f-xl in UI 1, f-d-xl in UI 2, f-d-xxl in UI 2 large display
sp-d-l: f-xl in UI 1, f-d-l in UI 2, f-d-xl in UI 2 large display
sp-d-m: f-l in UI 1, f-d-m in UI 2
sp-d-s: f-l in UI 1, f-d-s in UI 2
sp-d-xs: f-m in UI 1, f-d-xs in UI 2
sp-t-l: f-m in UI 1, f-t-l in UI 2
sp-t-m: f-s in UI 1, f-t-m in UI 2
sp-t-s: f-xs in UI 1, f-t-s in UI 2
sp-b-l: f-s in UI 1, f-b-l in UI 2
sp-b-m: f-xs in UI 1, f-b-m in UI 2
sp-b-s: f-xxxs in UI 1, f-b-s in UI 2
sp-b-cjk: f-s in UI 1, f-b-m in UI 2. This CSS class uses a font that contains all supported characters. Other fonts may not include all characters.
CSS classes for text in UI version 1:

f-xxl: 72px for small and medium, 110px for large display
f-xl: 50px for small and medium, 80px for large display
f-l: 35px for small and medium, 50px for large display
f-m: 25px for small and medium, 35px for large display
f-s: 20px for small and medium, 25px for large display
f-xs: 16px for small and medium, 23px for large display
f-xsn: 17px for small and medium display
f-xxs: 16px for small and medium, 18px for large display
f-xxxs: 14px for small and medium, 14px for large display
f-xxxsn: 13px for small and medium, 15px for large display
CSS classes for text UI version 2:

f-d-xxxl: data field font, 85px for medium, 155px for large display
f-d-xxl: data field font, 65px for medium, 118px for large display
f-d-xl: data field font, 57px for medium, 103px for large display
f-d-l: data field font, 50px for medium, 91px for large display
f-d-m: data field font, 42px for medium, 78px for large display
f-d-s: data field font, 35px for medium, 65px for large display
f-d-xs: data field font, 25px for medium, 46px for large display
f-t-l: title font, 28px for medium, 52px for large display
f-t-m: title font, 18px for medium, 33px for large display
f-t-s: title font, 14px for medium, 27px for large display
f-b-l: body font, 22px for medium, 41px for large display
f-b-m: body font, 19px for medium, 35px for large display
f-b-s: body font, 15px for medium, 29px for large display
JavaScript
The HTML template can also be used to run JavaScript.

For example, suppose we'd like to create a view with a title, 2 numeric values and a text. A brief illustration of a simple template with comments below.

<uiView
  onLoad="
    // JavaScript can be added here
  "
  onActivate="
    // JavaScript can be added here
  "
  onDeactivate="
    // JavaScript can be added here
  "
> <!-- This (uiView) defines the SuuntoPlus sports app view -->
    <div>
        <!-- Topmost: title field -->
        <div class="sp-title-bg" style="width:100%;height:20%;"></div>
        <div class="sp-title-text sp-t-m p-hc" style="top:5%">Example</div>

        <!-- Field just under the title, left side -->
        <!-- Field title -->
        <div class="f-s cm-mid" optional style="top:58px;left:calc(160px - 5px - 100%e);width:120px;max-height:34px;text-align:center;">Fibonacci</div>
        <!-- Field value -->
        <div class="f-l f-num" style="top:80px;left:calc(160px - 5px - 100%e);width:115px;text-align:center;">
            <!-- Eval element is replaced by the value from the input resource. This uses a resource that was created by the SuuntoPlus sports app and is _not_ native to the watch. -->
            <eval input="/Zapp/{zapp_index}/Output/fibonacciValue" outputFormat="Count_Fourdigits" default="--"/>
        </div>

        <!-- Field just under the title, right side -->
        <!-- Field title -->
        <div class="f-s cm-mid" optional style="top:58px;left:165px;width:120px;max-height:34px;text-align:center;">Duration</div>
        <!-- Field value -->
        <div class="f-l f-num" style="top:80px;left:165px;width:115px;text-align:center;">
            <!-- Eval element is replaced by the value from the input resource from the native duration resource. -->
            <eval input="/Activity/Move/-1/Duration/Current" outputFormat="Duration_FourdigitsFixed" default="--" />
        </div>

        <!-- Bottom text area -->
        <div class="f-s" style="top:calc(70% - 50%e);left:calc(50% - 50%e);width:75%;max-height:120px;text-align:center;">This is just some text area</div>
    </div>
</uiView>
JavaScript event handlers:

onLoad:
onActivate:
onDeactivate:
Icons in HTML
HTML templates support icons from the three different sets indicated by CSS class and icon code as follows:

<div class="f-ico" style="top:calc(50% - 100%e);left:calc(50% - 50%e);">&#xF178;</div>

where CSS class f-ico means that the icon is taken from the set 1 (other available sets are 2 and 3) and the code of the icon itself is F178.

Supported icons and their character codes are documented in Icons.

Note 1: Icons (with the same code) might look different in the future but the meaning should remain.

Note 2: Use documented codes to maintain compatibility (they will exist in the future).

e Syntax
The e syntax is a special CSS unit in SuuntoPlus used to represent the element's own dimensions within calc() functions. The e stands for "element", allowing you to reference the current element's width or height in CSS calculations, enabling dynamic positioning and layout based on the element's own size.

Use Cases
The e syntax is primarily used in the following scenarios:

Element Centering: Center elements relative to their own dimensions, maintaining centering regardless of element size changes
Offset Calculations: Calculate offsets based on element's own dimensions for precise visual alignment
Syntax Rules
The basic format of the e syntax is: X%e

Where:

X is a numeric value (0-100)
% is the percent sign
e is the element unit identifier
The e syntax can only be used within calc() functions in style attributes, and must follow the calc(X% - X%e) pattern, otherwise the build validation will fail.

Calculation Logic
When used in the horizontal direction left, X%e represents X% of the element's width
When used in the vertical direction top, X%e represents X% of the element's height
The calculation result is converted to pixel values for final CSS computation
Using e Syntax for Element Centering
left: calc(50% - 50%e);
top: calc(50% - 50%e);
Subtract half of the element's own dimensions from the parent container's center point, aligning the element's center with the parent container's center

Icon Centering Example
<div class="f-ico" style="top:calc(50% - 50%e);left:calc(50% - 50%e);">&#xF178;</div>
Data logging
Samples
Logging data can be achieved using the manifest file. As briefly mentioned in the manifest section of the document, the “out” parameters can be given a few simple instructions to log some specific output variable. E.g.,

manifest.json

{
    ... other stuff here ...
    "out": [
        { "name": "iWantToLogThis", "log": true, "shownName": "This will be shown as the graph name in the mobile app", "format": "Count_Fourdigits", inverted": false },
    ],
    ... and the rest ...
}
Where “log” (true/false) defines whether it should be logged, “shownName” (string) is the graph name in mobile app, “format” (string) defines the how the data should be formatted before drawing the graph and “inverted” (true/false) defines whether the graph should be drawn inverted or not. And also note that a maximum of 5 variables can be logged currently. The data will be saved every time after the sports app evaluate callback is called (and the data value has changed) which right now is about every 1 second. Mobile application will show a timeline graph of this data after the exercise has been synced.

Summary outputs
When saving the summary outputs in getSummaryOutputs callback in main.js, e.g., in the following way

function getSummaryOutputs(input, output) {
    return [
      { "id": "v", "name": "Some duration", "format": "Duration_Fourdigits", "value": myValue },
      { "id": "o", "name": "Some other duration", "format": "Duration_Fourdigits", "value": myOtherValue },
    ];
    // myValue & myOtherValue being some variables in this case
}
These are then saved in the header under SummaryOutputs array like explained below. Mobile application and watch shows these values after the exercise.

While one can fairly freely choose the id, using as short ids as possible is the best practice (e.g., 1 character). As of 5/25/2023 there's a hard limit of 8 summary outputs in the logs but there are other technicalities that limit the number of summary outputs. Thus one might face the limit at around 4 or 5 summary outputs.

Summary outputs can have a custom postfix, but it is not mandatory:

{ id: 'fat', name: 'Fat', format: 'Count_Fourdigits', value: output.tfb, postfix: 'g' }

Technical details
The samples have a structure which includes timestamp, the value and a channel id (more about this below). The object structure looks like the following

{
    "ZappSample": {
        "ChannelId": 7,
        "Value": 1.7058346271514893
    },
    "TimeISO8601": "2022-10-30T18:12:52.323+00:00"
},
Since more than 1 variable can be logged from a sports app at any given time, the samples need an id which links them to the specific sports app's specific variable. And this is what the channel ids are for. More about this in the “Header” section below

Header
On top of the samples, a header is saved to the log file. The header contains the sports app details including sample logging details and the possible summary outputs that are saved in the “getSummaryOutputs” callback function at the end of the exercise.

HeaderId can generally be ignored. For those who are interested, the channel id is formed using the header id and channel index. E.g., ChannelId == 0x10 * HeaderId + 0x01 * channel.
Id is the sports app id.
Name is the sports app name (defined in the manifest.json)
More about Channels and SummaryOutputs below.

The header could look like the following

"Zapps": [
  {
    "Zapp": {
      "Channels": [
        {
          "ChannelId": 4,
          "Format": "Distance_Threedigits",
          "Inverted": false,
          "Name": "Some Distance",
          "VariableId": "someDistanceRelatedThing"
        },
        {
          "ChannelId": 7,
          "Format": "Count_Fourdigits",
          "Inverted": false,
          "Name": "I Want To Log This",
          "VariableId": "iWantToLogThis"
        }
      ],
      "HeaderId": 0,
      "Id": "sportt01",
      "Name": "My Own Sports App",
      "SummaryOutputs": [
        {
          "Format": "Duration_Fourdigits",
          "Id": "v",
          "Name": "Some duration",
          "Postfix": "",
          "SummaryValue": 1987.4339599609375
        },
        {
          "Format": "Duration_Fourdigits",
          "Id": "o",
          "Name": "Some other duration",
          "Postfix": "",
          "SummaryValue": 156.39999389648438
        }
      ],
      "TimeISO8601": "2022-10-30T19:03:44.417+00:00"
    }
  }
],
Channels
Notice how we had a sample earlier which had a channelId of 7. Looking at the header, under Zapps[0].Zapp.Channels[1] there is a channelId of 7. This means that every sample that has a channelId of 7 belongs to variable which had a name of “iWantToLogThis”. The other information related to that parameter can also be found from the same object.

Sports app settings
Sports apps can have variables and settings that are remembered from workout to another. They can also be shown in Suunto mobile app where user can edit them.

Settings and variables are defined in an optional JSON file data.json, for example:

{
  "useCount": "3",
  "hydrationAlertFreqMin": "30.0",
  "intensity": "0",
  "internalData": {
    "intensityValues_W": [200, 300, 400]
  },
  "workout": {
    "AverageSpeed": {
      "goal": 10.0,
      "actual": 9.4
    },
    "targetHR": 170
  },
  "notifications": {
    "enable": false
  },
  "SensorID": "",
  "Marathon": {
    "Cities": ["Helsinki", "Oslo", "Rome"],
    "City": 0
  }
}
Everything but objects are stored as strings, also integers and floating point numbers and types are up to the sports app to interpret in whatever way it likes. However if variable or setting is shown to user then it must have valid initial value of type defined in manifest.json like specified below.

Manifest file manifest.json defines what is shown to user in Suunto mobile app:

{
...,
  "variables": [
    {"shownName": "Use count", "path": "useCount", "type": "int"},
    {"shownName": "Average speed (km/h)", "path": "workout.AverageSpeed.actual", "type": "float"}
  ],
  "settings": [
    {"shownName": "Hydration alert frequency", "path": "hydrationAlertFreqMin", "type": "float", "min": 1, "max": 120.1},
    {"shownName": "Intensity", "path": "intensity", "type": "enum", "values": ["low", "medium", "high"]},
    {"shownName": "Average speed target [km/h]", "path": "workout.AverageSpeed.goal", "type": "float", "min": 1, "max": 30},
    {"shownName": "Sensor ID", "path": "SensorID", "type": "string", "maxLength": 10, "mandatory": ""},
    {"shownName": "Marathon city", "path": "Marathon.City", "type": "enum", "valuePath": "Marathon.Cities"},
    {"shownName": "Notifications enabled", "path": "notifications.enable", "type": "boolean"},
    {"shownName": "High intensity interval heart rate target [bpm]", "path": "workout.targetHR", "type": "int", "min": 120, "max": 199, "inputType": "slider"}
  ],
...,
}
Two new fields are introduced variables and settings :

variables is list of variable objects that represent values that are displayed to user
variable object consist of fields
shownName that is name of the variable visible to user
path that is reference to variable in data.jsn file of which value is displayed to user, usually
key like useCount or workOut.AverageSpeed.actual
but can also be index of a list like results[4]
type that is saving type of variable in data.jsn, options are
int for integer number
float for floating point number
string for string of characters
boolean for a boolean variable
settings is list of setting objects that represent settings that user can set
setting object consist of same fields as variable with some additions
type field additions
int and float allow optional keywords
min and max. If both min and max are defined, max must be greater than min
inputType of which possible values are
slider, when using slider, min and max values are mandatory
string allow optional keyword
maxLength that is bytes (in UTF-8 encoding)
enum is addition to types for variable.
One of the following is mandatory
keyword values that is list of strings
keyword valuePath that is reference to list of strings in object in data.jsn
Saving type of enum in data.jsn is integer and that is index of the list (values or valuePath)
Fields that are not in variables object in settings object
mandatory that is optional string type to mark setting that can't have meaningful default value
value can include additional information like "Lorem ipsum dolor sit amet", but can be empty string ""
If the shownName of a variable or a setting contains a string wrapped inside [ and ] at the end, then it is interpreted as the unit for the variable or setting
For example, "shownName": "Average speed [km/h]" means the visible name in the settings UI is Average speed and the unit, shown after the value, is km/h
JavaScript interface
Interface for sports apps is an extended subset of HTML Web storage interface.

Only localStorage is available (not sessionStorage)
Functions from Storage interface are
localStorage.setItem (key, value)
Sets the value of the pair identified by key to value, creating a new key/value pair if none existed for key previously. Value is saved as a string.
value = localStorage.getItem (key)
Returns the current value associated with the given key as a string, or null if the given key does not exist.
Returns null if value is object (saved using setObject)
Storage interface is extended with two functions (described for example here stackoverflow.com)
localStorage.setObject (key, value)
value = localStorage.getObject (key)
Returns null if value is string (saved using setItem)
Working examples
Generic example
Showcases a generic working example. For bouldering, the native ascent time might not be the best estimator for the time spent actually climbing. Thus here we have a simple SuuntoPlus sports app that estimates bouldering climbing time and attempts based on heart rate and its changes. The example is meant for showcasing how to use the system. It might not be good for the actual exercise purpose.

manifest.json
{
  "name": "Bouldering app",
  "version": "1.0",
  "author": "Suunto",
  "description": "Working example",
  "in": [
    { "name": "duration", "source": "Activity/Move/-1/Duration/Current", "type": "subscribe" },
    { "name": "hr", "source": "Activity/Move/-1/HeartRate/Current", "type": "subscribe" }
  ],
  "out": [
    { "name": "climbTime" },
    { "name": "climbAttempts" }
  ],
  "template": [
    { "name": "t.html" }
  ]
}
main.js
var isPaused, currentTemplate, maxHr, climbAttempts, climbTime, counter, yy, diff, climbing, prevDuration;

/*********************
 * Custom functions
 *********************/
var appendValue = function(arr, value) {
  for (var i = 0; i < arr.length - 1; ++i)
    arr[i] = arr[i+1];
  arr[arr.length - 1] = value;
}

// 5 point sav-gol quadratic derivative. Assumes eval is called exactly once per second for simplicity.
var savitzkyGolayDerivative = function(arr) {
  return (-2*arr[0] - arr[1] + arr[3] + 2*arr[4]) / 10;
}

/*********************
 * Callback functions
 *********************/

// Main.js is loaded
function onLoad(input, output) {
  currentTemplate = 't';
  isPaused = 1;
  maxHr = 0;
  climbAttempts = 0;
  climbTime = 0;
  climbing = 0;
  counter = 0;
  yy = [1.35, 1.35, 1.35, 1.35, 1.35]; // 81 bpm. Initiating these a bit high intentionally.
}

// Exercise actually starts
function onExerciseStart() {
  isPaused = 0;
  prevDuration = 0;
}

function onExercisePause() {
  isPaused = 1;
}

function onExerciseContinue() {
  isPaused = 0;
}

// Triggers once per second ish
function evaluate(input, output) {
  if (isPaused) return;   // Don't do anything if the system is paused

  if (input.hr >= maxHr) {
    // Update the max hr text on the screen
    maxHr = input.hr;
  }
  setText("#text-area", "Your max HR is " + Math.round(60 * maxHr));

  // Calculate HR derivative
  appendValue(yy, input.hr);
  diff = savitzkyGolayDerivative(yy);

  // We are probably climbing if
  // - HR diff is well above 75bpm and hr is a bit on the rise
  // OR
  // - HR is very high and HR diff is _not_ negative
  if ((input.hr > 1.36 && diff > .015 ) || (input.hr > 1.6 && diff > 0)) {
    if (counter < 3) ++counter;
  }
  else if (counter > 0) --counter;

  // Turn climbing on/off
  if (counter == 3) climbing = 1;
  else if (counter == 0) {
    // Check also if we were climbing and increment counter if so
    if (climbing) ++climbAttempts;
    climbing = 0;
  }

  // Increment climbing time if we seem to be climbing
  if (climbing) climbTime += input.duration - prevDuration;

  output.climbAttempts = climbAttempts;
  output.climbTime = climbTime;

  prevDuration = input.duration;
}

function getUserInterface() {
  return {
    template: currentTemplate
  };
}

function getSummaryOutputs(input, output) {
  return [
    {
      id: 'climbAttempts',
      name: "Climb attempts",
      format: 'Count_Fourdigits',
      value: output.climbAttempts
    },
    {
      id: 'climbTime',
      name: "Climb time",
      format: 'Duration_Fourdigits',
      value: output.climbTime
    }
  ];
}
t.html
<uiView>
  <div>
      <!-- Topmost: title field -->
      <div class="sp-title-bg" style="width:100%;height:20%;"></div>
      <div class="sp-title-text sp-t-m p-hc" style="top:5%">Example</div>

      <!-- Field just under the title, left side -->
      <div class="f-s cm-mid" optional style="top:52px;left:calc(160px - 5px - 100%e);width:120px;max-height:34px;text-align:center;">HR</div>
      <div class="f-l f-num" style="top:74px;left:calc(160px - 5px - 100%e);width:115px;text-align:center;">
          <eval input="/Activity/Move/-1/Heartrate/Current" outputFormat="HeartRate_Fourdigits" default="--"/>
      </div>

      <!-- Field just under the title, right side -->
      <div class="f-s cm-mid" optional style="top:52px;left:165px;width:120px;max-height:34px;text-align:center;">Duration</div>
      <div class="f-l f-num" style="top:74px;left:165px;width:115px;text-align:center;">
          <eval input="/Activity/Move/-1/Duration/Current" outputFormat="Duration_FourdigitsFixed" default="--" />
      </div>

      <!-- Field just under the upper value, left side -->
      <div class="f-s cm-mid" optional style="top:132px;left:calc(160px - 5px - 100%e);width:120px;max-height:34px;text-align:center;">Attempts</div>
      <div class="f-l f-num" style="top:154px;left:calc(160px - 5px - 100%e);width:115px;text-align:center;">
          <eval input="/Zapp/{zapp_index}/Output/climbAttempts" outputFormat="Count_Threedigits" default="--" />
      </div>

      <!-- Field just under the upper value, right side -->
      <div class="f-s cm-mid" optional style="top:132px;left:165px;width:120px;max-height:34px;text-align:center;">Climb time</div>
      <div class="f-l f-num" style="top:154px;left:165px;width:115px;text-align:center;">
          <eval input="/Zapp/{zapp_index}/Output/climbTime" outputFormat="Duration_FourdigitsFixed" default="--"/>
      </div>

      <!-- Bottom text area. Insert "-" in the div or otherwise the element gets optimized away -->
      <div id="text-area" class="f-s" style="top:calc(82% - 50%e);left:calc(50% - 50%e);width:70%;max-height:80px;text-align:center;">-</div>
  </div>
</uiView>
Localization support
Texts in HTML can be localized to one or more languages when application is compiled. Text identifiers in HTML are replaced with values from a language specific JSON file. Text identifier is a {{ , some identifier value, followed by a }}.

HTML example with localized title text:

<div class="cm-fg" style="width:100%;height:25%;">
  <div id="middle-text" class="f-s p-hc" style="top:calc(60% - 50%e);">{{title}}</div>
</div>
English language data example file en.json:

{
  "title": "Title text",
  "anotherText": "Some other text"
}
Finnish language data example file fi.json:

{
  "title": "Otsikkoteksti",
  "anotherText": "Jotain aivan muuta"
}
SuuntoPlus Editor's "SuuntoPlus application language" setting defines which language is used when application is compiled. The following language codes are supported:

da: Danish
de: German
en: English
es: Spanish
fr: French
it: Italian
nl: Dutch
no: Norwegian
pt: Portuguese
fi: Finnish
sv: Swedish
zh-Hans: Chinese
ja: Japanese
ko: Korean
cs: Czech
pl: Polish
ru: Russian
th: Thai
tr: Turkish
he: Hebrew
el: Greek
zh-Hant: Traditional Chinese
BLE Device Connection
This section describes how to create a SuuntoPlus sports app that connects to a Bluetooth device. You can also run "SuuntoPlus: Create SuuntoPlus App" command in VS Code to create a basic BLE sports app.

Technical
Current watch firmwares:

Suunto 3, Suunto 5, Suunto 5 Peak, Suunto 9, Suunto 9 Baro and Suunto 9 Peak

Support only one connection at a time.
ATT Maximum Transmission Unit (MTU) (i.e the maximum length of an ATT packet) is fixed to 23.
Suunto 9 Peak Pro, Suunto Vertical, Suunto Vertical 2, Suunto Race, Suunto Race S、Suunto Race 2、Suunto Ocean, Suunto Ocean Lite

Support two connections at a time.
ATT Maximum Transmission Unit (MTU) (i.e the maximum length of an ATT packet) is fixed to 127.
Manifest
From firmware version 2.22.32 onwards SuuntoPlus sports apps that use BLE device connection require following changes in the manifest.json file:

Type field should now contain "device" i.e.

"type": "device"

and output variable named "con" should be introduced in manifest

"out": [
  { "name": "con" }
]
These relate to a Searching-view that is popup when BLE SuuntoPlus sports app is selected from the the device and closed when the value of output.con variable is set to differing from zero in the main.js (see example in the “Implementation Step by Step” chapter).

Functions
SuuntoPlus sports app system provides appConn object that is used to handle BLE connections with the following functions:

connect function
Arguments:
enabledZappId: Any integer should be fine here but using "enabledZappId" is fine due to previous implementation
bleEventHandler: Function to handle all events related to BLE connection.
searchParam1: Byte array, max length 16 bytes
searchParam2: Optional byte array, max length 16 bytes
Return value: connectionId to be used in other appConn functions.
Make BLE GATT connection. Note: Disconnect is done automatically on application unload.

bleEventHandler:

var evHandler = function (ch, e, d) { }

where

ch: your registered characteristicId this event relates to.
e: event id (see table below of available ids).
d: data (if applicable).
searchParams:

The first byte in the array indicates from which advertised field following bytes are searched:

2 = Partial list of 16 bit service UUIDs.
3 = Complete list of 16 bit service UUIDs.
4 = Partial list of 32 bit service UUIDs.
5 = Complete list of 32 bit service UUIDs.
6 = Partial list of 128 bit service UUIDs.
7 = Complete list of 128 bit service UUIDs.
8 = Short local device name.
9 = Complete local device name.
255 = Manufacturer Specific Data.
E.g Connecting to device with service UUID 0xFDF3 searchParam1 could be [3, 0xF3, 0xFD] and searchParam2 [2, 0xF3, 0xFD].

Triggers the following events (bleEventHandler):

111 (CONNECT_DONE): Connection attempt is made
112 (CONNECT_FAILED): Connect call execution failed
100 (CONNECTED): The device is connected successfully
101 (DISCONNECTED): Connection failed
regUuid function
Arguments:
connectionId: Integer, ID of the connection returned by connect function.
characteristicId: Integer, your own id to refer to this characteristic. E.g. 1 for your first characteristic, 2 for the second and so on.
serviceUuid: Array of bytes, little-endian
characteristicUuid: Array of bytes, little-endian
Return value: -
BLE GATT connection UUID registration.

I.e. your characteristicId is associated to given Service UUID/Characteristic UUID to be used later in other appConn functions.

Triggers one of the following events (bleEventHandler):

107 (UUID_REGISTERED): Registration succeeded and characteristicId can now be used in other appConn functions.
108 (UUID_REGISTERED_FAILED)
readChar function
Arguments:
connectionId: Integer, ID of the connection returned by connect function.
characteristicId: Integer, ID you registered with regUuid function to represent certain characteristic.
Return value: -
BLE GATT connection characteristic read. Triggers one of the following events (bleEventHandler):

102 (READ_DONE): Reading succeeded. data parameter of the event handler contains the data read from the characteristic.
103 (READ_FAILED)
writeChar function
Arguments:
connectionId: Integer, ID of the connection returned by connect function.
characteristicId: Integer, ID you registered with regUuid function to represent certain characteristic.
data: Array of bytes, max length 20 bytes
Return value: -
BLE GATT connection characteristic write. Note: Max data length is 20 bytes (MTU negotiation is not supported). Triggers one of the following events (bleEventHandler):

104 (WRITE_DONE): Writing succeeded
105 (WRITE_FAILED)
enaCharNotf function
Arguments:
connectionId: Integer number, ID of the connection returned by connect function.
characteristicId: Integer, ID you registered with regUuid function to represent certain characteristic.
Return value: -
Enable BLE GATT connection characteristic notifications. Triggers one of the following events (bleEventHandler):

109 (CONFIG_DONE): Notifications enabled successfully
110 (CONFIG_FAILED)
Starts to trigger 106 (NOTIFICATION) events to bleEventHandler whenever data is available.

Events
Event handler
Events are received in event handler function like this:

var bleEventHandler = function (characteristicId, eventId, data) {
  switch (eventId) {
    case 100: // Connected
      ...
      break;
    ...
  }
}
Input parameters in event handler function are:

Input parameter	Type	Description
characteristicId	integer number	Your characteristicId (Note! not the UUID, but your own id that has been associated with appConn.regUuid() to certain characteristic UUID) that this event relates to.
eventId	integer number	Event id (see available ids in table below).
data	any (byte array)	Data relating to the event (if applicable as most of the events have no data)
Event handler is set in as appConn.connect parameter (see description above).

Event ids
Id	Name	Description
100	CONNECTED	Device is successfully connected.
101	DISCONNECTED	Device is disconnected or connection failed. Note! Automatic reconnection is attempted by the system.
102	READ_DONE	Data reading (appConn.readChar) succeeded. Data parameter contains data read from the characteristic.
103	READ_FAILED	Data reading (appConn.readChar) failed
104	WRITE_DONE	Data writing (appConn.writeChar) succeeded
105	WRITE_FAILED	Data writing (appConn.writeChar) failed
106	NOTIFICATION	Notification data received. Data parameter contains data received from the characteristic.
107	UUID_REGISTERED	Service/Characteristic UUID registration succeeded
108	UUID_REGISTERED_FAILED	Service/Characteristic UUID registration failed
109	CONFIG_DONE	Notifications enabled successfully
110	CONFIG_FAILED	Failed to enable notifications
111	CONNECT_DONE	Connect call done (whether the connection actually succeeded or not is not known yet). Eventually event id 100 indicates successful connection and 101 failed.
112	CONNECT_FAILED	Connect call failed
Implementation step by step
Connection and receiving notifications
Very simple example how to receive notifications from the BLE device. Note that this is trying to be as simple and clear as possible e.g. error handling is omitted as well as various ways to minimise code size.

1. Implement evaluate function and event handler skeletons

At first we implement basic skeleton for our BLE SuuntoPlus sports app.

var state = 0; // Current connection flow state

function evaluate(input, output) {
  switch (state) {
    case 0:
      break;
  }
}

var bleEventHandler = function (characteristicId, eventId, data) {
  switch (eventId) {
  }
}
2. Connect to the device

In this step device connection is added (in this case to any device with 0xFDF3 service).

var state = 0,    // Current connection flow state
    connectionId; // ID of our connection

var connect = function () {
  connectionId = appConn.connect( // appConn: System object for connection handling
    enabledZappId,
    bleEventHandler,  // Our event handler function
    [3, 0xF3, 0xFD],  // Search our service UUID 0xFDF3 from complete list of 16 bit service UUIDs
    [2, 0xF3, 0xFD]); // and also from partial list
 }

function evaluate(input, output) {
  switch (state) {
    case 0: // Do connect
      connect();
      state = 99; // Wait for CONNECTED event
      break;
    case 1:
      break;
  }
}

var bleEventHandler = function (characteristicId, eventId, data) {
  switch (eventId) {
    case 100: // CONNECTED
      state = 1; // Next register characteristic
      break;
  }
}

function onLoad(input, output) {
  // System automatically checks out-variable named "con" (should be introduced in the manifest)
  // and when it differs from zero value "Searching"-view is closed
  output.con = 0;
}
3. Register Service/characteristic UUIDs for notifications

In this step we add registration of our notification characteristic.

var state = 0,      // Current connection flow state
    connectionId,   // ID of our connection
    charId = 1,     // ID of our notification characteristic
    registered = 0; // If 1 the characteristic is registered

var connect = function () {
  connectionId = appConn.connect( // appConn: System object for connection handling
    enabledZappId,
    bleEventHandler,  // Our event handler function
    [3, 0xF3, 0xFD],  // Search our service UUID 0xFDF3 from complete list of 16 bit service UUIDs
    [2, 0xF3, 0xFD]); // and also from partial list
 }

var regCharacteristic = function () {
  appConn.regUuid(
    connectionId, // ID of our connection
    charId, // ID to refer to this characteristic later
    [0,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1],  // Our dummy service UUID 01020304-0506-0708-090A-0B0C0D0E0F00 (little-endian)
    [1,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1]); // Our dummy characteristic UUID 01020304-0506-0708-090A-0B0C0D0E0F01 (little-endian)
}

function evaluate(input, output) {
  switch (state) {
    case 0: // Do connect
      connect();
      state = 99; // Wait for CONNECTED event
      break;
    case 1: // Register notification characteristic
      if (!registered) { // Do not register (while reconnecting) if already done
        regCharacteristic();
        state = 99; // Wait for UUID_REGISTERED event
      } else {
        state = 2;
      }
      break;
    case 2;
      break;
  }
}

var bleEventHandler = function (characteristicId, eventId, data) {
  switch (eventId) {
    case 100: // CONNECTED
      state = 1; // Next register characteristic
      break;
    case 107: // UUID_REGISTERED
      registered = 1;
      state = 2; // Next enable notifications
      break;
  }
}
4. Enable notifications

Next enable notification sending from the device.

var state = 0,      // Current connection flow state
    connectionId,   // ID of our connection
    charId = 1,     // ID of our notification characteristic
    registered = 0; // If 1 the characteristic is registered

var connect = function () {
  connectionId = appConn.connect( // appConn: System object for connection handling
    enabledZappId,
    bleEventHandler,  // Our event handler function
    [3, 0xF3, 0xFD],  // Search our service UUID 0xFDF3 from complete list of 16 bit service UUIDs
    [2, 0xF3, 0xFD]); // and also from partial list
 }

var regCharacteristic = function () {
  appConn.regUuid(
    connectionId, // ID of our connection
    charId, // ID to refer to this characteristic later
    [0,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1],  // Our dummy service UUID 01020304-0506-0708-090A-0B0C0D0E0F00 (little-endian)
    [1,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1]); // Our dummy characteristic UUID 01020304-0506-0708-090A-0B0C0D0E0F01 (little-endian)
}

var enableNotif = function ()  {
  appConn.enaCharNotf(connectionId, charId);
}

function evaluate(input, output) {
  switch (state) {
    case 0: // Do connect
      connect();
      state = 99; // Wait for CONNECTED event
      break;
    case 1: // Register notification characteristic
      if (!registered) { // Do not register (while reconnecting) if already done
        regCharacteristic();
        state = 99; // Wait for UUID_REGISTERED event
      } else {
        state = 2;
      }
      break;
    case 2: // Enable notifications
      enableNotif();
      state = 99; // Wait for CONFIG_DONE event and the first notification
      break;
    case 3:
      // Connection is ready -> close the Searching-view
      output.con = 1; // Setting output variable "con" to a non-zero value is a hardcoded mechanism in the watch to close the Searching-view.
      break;
  }
}

var bleEventHandler = function (characteristicId, eventId, data) {
  switch (eventId) {
    case 100: // CONNECTED
      state = 1; // Next register characteristic
      break;
    case 107: // UUID_REGISTERED
      registered = 1;
      state = 2; // Next enable notifications
      break;
    case 109: // CONFIG_DONE
      state = 3; // Connection is successfully done -> Searching-view could be closed next
      break;
  }
}
5. Handle notifications

And finally in this step we add notification receiving logic.

var state = 0,      // Current connection flow state
    connectionId,   // ID of our connection
    charId = 1,     // ID of our notification characteristic
    registered = 0, // If 1 the characteristic is registered
    valueFromDevice = 0.0; // Float value received from the device

var connect = function () {
  connectionId = appConn.connect( // appConn: System object for connection handling
    enabledZappId,
    bleEventHandler,  // Our event handler function
    [3, 0xF3, 0xFD],  // Search our service UUID 0xFDF3 from complete list of 16 bit service UUIDs
    [2, 0xF3, 0xFD]); // and also from partial list
 }

var regCharacteristic = function () {
  appConn.regUuid(
    connectionId, // ID of our connection
    charId, // ID to refer to this characteristic later
    [0,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1],  // Our dummy service UUID 01020304-0506-0708-090A-0B0C0D0E0F00 (little-endian)
    [1,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1]); // Our dummy characteristic UUID 01020304-0506-0708-090A-0B0C0D0E0F01 (little-endian)
}

var enableNotif = function ()  {
  appConn.enaCharNotf(connectionId, charId);
}

function evaluate(input, output) {
  switch (state) {
    case 0: // Do connect
      connect();
      state = 99; // Wait for CONNECTED event
      break;
    case 1: // Register notification characteristic
      if (!registered) { // Do not register (while reconnecting) if already done
        regCharacteristic();
        state = 99; // Wait for UUID_REGISTERED event
      } else {
        state = 2;
      }
      break;
    case 2: // Enable notifications
      enableNotif();
      state = 99; // Wait for CONFIG_DONE event
      break;
    case 3:
      // Connection is ready -> close the Searching-view
      output.con = 1; // Setting out-variable "con" to differing from zero value is a hardcoded mechanism in the watch to close the Searching-view.
      state = 99; // Wait for the first notification
      break;
    case 4: // Handle received value
      // Do something with valueFromDevice
      state = 99; // Wait for the next notification
      break;
  }
}

var bleEventHandler = function (characteristicId, eventId, data) {
  switch (eventId) {
    case 100: // CONNECTED
      state = 1; // Next register characteristic
      break;
    case 107: // UUID_REGISTERED
      registered = 1;
      state = 2; // Next enable notifications
      break;
    case 109: // CONFIG_DONE
      state = 3; // Connection is succesfully done -> Searching-view could be closed next
      break;
    case 106: // NOTIFICATION
      // Parse data e.g. something like this (of course depends on your device)
      if (characteristicId == charId && data.length >= 6) {
        var uint8Arr = new Uint8Array(4);
        uint8Arr[0] = data[0];
        uint8Arr[1] = data[1];
        uint8Arr[2] = data[4];
        uint8Arr[3] = data[5];

        var dataView = new DataView(uint8Arr.buffer);
        valueFromDevice = dataView.getFloat32(0, true);
        state = 4; // Next do something with the value received
      }
      break;

    // TODO: Handle error events
  }
}
Reading and writing
Example how to read from a characteristic and write to another. Again error handling is omitted as well as various ways to minimise code size.

Steps 1 and 2 can be the same as above thus skipped here.

3. Register Service/characteristic UUIDs for read and write

After the device is connected we can register our read and write characteristics.

var state = 0,       // Current connection flow state
    connectionId,    // ID of our connection
    registered = 0,  // If 1 the characteristic is registered
    readCharId = 1,  // ID of read characteristic
    writeCharId = 2; // ID of write characteristic

var connect = function () {
  connectionId = appConn.connect( // appConn: System object for connection handling
    enabledZappId,
    bleEventHandler,  // Our event handler function
    [3, 0xF3, 0xFD],  // Search our service UUID 0xFDF3 from complete list of 16 bit service UUIDs
    [2, 0xF3, 0xFD]); // and also from partial list
 }

var regReadCharacteristic = function () {
  appConn.regUuid(
    connectionId, // ID of our connection
    readCharId, // ID to refer to this characteristic later
    [0,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1],  // Our dummy service UUID 01020304-0506-0708-090A-0B0C0D0E0F00 (little-endian)
    [2,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1]); // Our dummy read characteristic UUID 01020304-0506-0708-090A-0B0C0D0E0F02 (little-endian)
}

var regWriteCharacteristic = function () {
  appConn.regUuid(
    connectionId, // ID of our connection
    writeCharId, // ID to refer to this characteristic later
    [0,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1],  // Our dummy service UUID 01020304-0506-0708-090A-0B0C0D0E0F00 (little-endian)
    [3,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1]); // Our dummy write characteristic UUID 01020304-0506-0708-090A-0B0C0D0E0F03 (little-endian)
}

function evaluate(input, output) {
  switch (state) {
    case 0: // Do connect
      connect();
      state = 99; // Wait for CONNECTED event
      break;
    case 1: // Register read characteristic
      if (!registered) { // Do not register (while reconnecting) if already done
        regReadCharacteristic();
        state = 99; // Wait for UUID_REGISTERED event
      } else {
        state = 3;
      }
      break;
    case 2: // Register write characteristic
      regWriteCharacteristic();
      state = 99; // Wait for UUID_REGISTERED event
      break;
    case 3:
      // Connection is ready -> close the Searching-view
      output.con = 1; // Setting out-variable "con" to differing from zero value is a hardcoded mechanism in the watch to close the Searching-view.
      state = 4; // Next read from characteristic
      break;
    case 4:
      break;
  }
}

var bleEventHandler = function (characteristicId, eventId, data) {
  switch (eventId) {
    case 100: // CONNECTED
      state = 1; // Next register read characteristic
      break;
    case 107: // UUID_REGISTERED
      registered = 1;
      if (characteristicId == readCharId) {
        state = 2; // Next register write characteristic
      } else if (characteristicId == writeCharId) {
        state = 3; // Close the Searching-view
      }
      break;
  }
}
4. Read from a characteristic

Now we have characteristics registered and in this step we can start reading data from the device.

var state = 0,       // Current connection flow state
    connectionId,    // ID of our connection
    registered = 0,  // If 1 the characteristic is registered
    readCharId = 1,  // ID of read characteristic
    writeCharId = 2, // ID of write characteristic
    readValue;       // Value read from the device

var connect = function () {
  connectionId = appConn.connect( // appConn: System object for connection handling
    enabledZappId,
    bleEventHandler,  // Our event handler function
    [3, 0xF3, 0xFD],  // Search our service UUID 0xFDF3 from complete list of 16 bit service UUIDs
    [2, 0xF3, 0xFD]); // and also from partial list
 }

var regReadCharacteristic = function () {
  appConn.regUuid(
    connectionId, // ID of our connection
    readCharId, // ID to refer to this characteristic later
    [0,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1],  // Our dummy service UUID 01020304-0506-0708-090A-0B0C0D0E0F00 (little-endian)
    [2,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1]); // Our dummy read characteristic UUID 01020304-0506-0708-090A-0B0C0D0E0F02 (little-endian)
}

var regWriteCharacteristic = function () {
  appConn.regUuid(
    connectionId, // ID of our connection
    writeCharId, // ID to refer to this characteristic later
    [0,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1],  // Our dummy service UUID 01020304-0506-0708-090A-0B0C0D0E0F00 (little-endian)
    [3,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1]); // Our dummy write characteristic UUID 01020304-0506-0708-090A-0B0C0D0E0F03 (little-endian)
}

var readCharacteristic = function () {
  appConn.readChar(connectionId, readCharId);
}

function evaluate(input, output) {
  switch (state) {
    case 0: // Do connect
      connect();
      state = 99; // Wait for CONNECTED event
      break;
    case 1: // Register read characteristic
      if (!registered) { // Do not register (while reconnecting) if already done
        regReadCharacteristic();
        state = 99; // Wait for UUID_REGISTERED event
      } else {
        state = 3;
      }
      break;
    case 2: // Register write characteristic
      regWriteCharacteristic();
      state = 99; // Wait for UUID_REGISTERED event
      break;
    case 3:
      // Connection is ready -> close the Searching-view
      output.con = 1; // Setting out-variable "con" to differing from zero value is a hardcoded mechanism in the watch to close the Searching-view.
      state = 4; // Next read from characteristic
      break;
    case 4: // Read
      readCharacteristic();
      state = 99; // Wait for READ_DONE event
      break;
  }
}

var bleEventHandler = function (characteristicId, eventId, data) {
  switch (eventId) {
    case 100: // CONNECTED
      state = 1; // Next register read characteristic
      break;
    case 107: // UUID_REGISTERED
      registered = 1;
      if (characteristicId == readCharId) {
        state = 2; // Next register write characteristic
      } else if (characteristicId == writeCharId) {
        state = 3; // Close the Searching view
      }
      break;
    case 102: // READ_DONE
      if (characteristicId == readCharId && data.length >= 2) {
        var uint8Arr = new Uint8Array(2);
        uint8Arr[0] = data[0];
        uint8Arr[1] = data[1];

        var dataView = new DataView(uint8Arr.buffer);
        readValue = dataView.getInt16(0, true);
        state = 4; // Next write value
      }
      break;
  }
}
5. Write to a characteristic

And finally in this step writing to our registered characteristic is added.

var state = 0,       // Current connection flow state
    connectionId,    // ID of our connection
    registered = 0,  // If 1 the characteristic is registered
    readCharId = 1,  // ID of read characteristic
    writeCharId = 2, // ID of write characteristic
    readValue;       // Value read from the device

var connect = function () {
  connectionId = appConn.connect( // appConn: System object for connection handling
    enabledZappId,
    bleEventHandler,  // Our event handler function
    [3, 0xF3, 0xFD],  // Search our service UUID 0xFDF3 from complete list of 16 bit service UUIDs
    [2, 0xF3, 0xFD]); // and also from partial list
 }

var regReadCharacteristic = function () {
  appConn.regUuid(
    connectionId, // ID of our connection
    readCharId, // ID to refer to this characteristic later
    [0,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1],  // Our dummy service UUID 01020304-0506-0708-090A-0B0C0D0E0F00 (little-endian)
    [2,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1]); // Our dummy read characteristic UUID 01020304-0506-0708-090A-0B0C0D0E0F02 (little-endian)
}

var regWriteCharacteristic = function () {
  appConn.regUuid(
    connectionId, // ID of our connection
    writeCharId, // ID to refer to this characteristic later
    [0,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1],  // Our dummy service UUID 01020304-0506-0708-090A-0B0C0D0E0F00 (little-endian)
    [3,15,14,13,12,11,10,9,8,7,6,5,4,3,2,1]); // Our dummy write characteristic UUID 01020304-0506-0708-090A-0B0C0D0E0F03 (little-endian)
}

var readCharacteristic = function () {
  appConn.readChar(connectionId, readCharId);
}

var writeCharacteristic = function () {
  // Write some dummy data
  appConn.writeChar(connectionId, writeCharId, [1,2,3]);
}

function evaluate(input, output) {
  switch (state) {
    case 0: // Do connect
      connect();
      state = 99; // Wait for CONNECTED event
      break;
    case 1: // Register read characteristic
      if (!registered) { // Do not register (while reconnecting) if already done
        regReadCharacteristic();
        state = 99; // Wait for UUID_REGISTERED event
      } else {
        state = 3;
      }
      break;
    case 2: // Register write characteristic
      regWriteCharacteristic();
      state = 99; // Wait for UUID_REGISTERED event
      break;
    case 3:
      // Connection is ready -> close the Searching-view
      output.con = 1; // Setting out-variable "con" to differing from zero value is a hardcoded mechanism in the watch to close the Searching-view.
      state = 4; // Next read from characteristic
      break;
    case 4: // Read
      readCharacteristic();
      state = 99; // Wait for READ_DONE event
      break;
    case 5: // Write
      writeCharacteristic();
      state = 99; // Wait for WRITE_DONE event
      break;
  }
}

var bleEventHandler = function (characteristicId, eventId, data) {
  switch (eventId) {
    case 100: // CONNECTED
      state = 1; // Next register read characteristic
      break;
    case 107: // UUID_REGISTERED
      registered = 1;
      if (characteristicId == readCharId) {
        state = 2; // Next register write characteristic
      } else if (characteristicId == writeCharId) {
        state = 3; // Close the Searching view
      }
      break;
    case 102: // READ_DONE
      if (characteristicId == readCharId && data.length >= 2) {
        var uint8Arr = new Uint8Array(2);
        uint8Arr[0] = data[0];
        uint8Arr[1] = data[1];
        var dataView = new DataView(uint8Arr.buffer);
        readValue = dataView.getInt16(0, true);
        state = 5; // Next write value
      }
      break;
    case 104: // WRITE_DONE
      if (characteristicId == writeCharId) {
        state = 4; // Loop to read again
      }
      break;

    // TODO: Handle error events
  }
}
Error codes
Error codes for BLE API errors in system events, for example:

#318716 04.12.2023 13:21:18 : ERR BLE : Duktape BLE API err 8

0: No error
1: Connection already exists
2: Connection limit reached
3: Connection not found
4: Connection initialization failed
5: Invalid parameters
6: Characteristic map failed
7: Characteristic not mapped
8: Not connected
9: Request allocation failed
10: Request queue failed
11: Request interrupted
12: Request send failed
13: Request exec failed
14: Request remote error
Optimizing applications
Disk space
SuuntoPlus application size can be optimized by omitting watch specific HTML or image files. This can be done by adding optional displays property to manifest file. If display ID of the watch doesn't match value in manifest, HTML or image file is removed when application is built.

See Watch displays for more information and possible values in displays.

{
  "name": "My app",
  "version": "1.0",
  "author": "Suunto",
  "description": "Running workout",
  "type": "feature",
  "usage": "workout",
  "modificationTime": 1234567890,
  "in": [],
  "out": [],
  "template": [
    { "name": "s.html", "displays": ["s"] },
    { "name": "m.html", "displays": ["m"] },
    { "name": "l.html", "displays": ["l"] },
    { "name": "n.html", "displays": ["n"] },
    { "name": "o.html", "displays": ["o"] },
    { "name": "q.html", "displays": ["q"] }
  ],
  "image": [
    { "name": "icon.png", "type": "a64" },
    { "name": "icon-large.png", "type": "a64" }
  ]
}
File names
Application size is also affected by file names. Shorter file names are recommended. Adding application name to a HTML file name is unnecessary.

For example:

fitness-test-warmup.html → w.html

Application memory
Typed arrays
For large arrays of data one should consider using the typed arrays, e.g., Float32Array or Uint8Array.

Bitmasks
Another possibility would be to use bitmasks for storing multiple variables. Something to keep in mind though is that this makes the code a bit more harder to read and also limits the min/max values of the bitmasked variables.

E.g.,

// Save 4 variables to a single js variable (Js behaves in a funny fashion and even though the bit operations only work up to 32bit values the underlying variable is a 64bit float)
// Each of the 4 variables consumes 8 bits
var bitMask = (2 << 24) + (4 << 16) + (123 << 8) + (42 << 0); // variable_1 == 2, variable_2 == 4, variable_3 == 123 & variable_4 = 42

// And then to get a number from the masked variable
var variable_2 = ((bitMask >> 16) & 0xFF); // variable_2 == 4

// And to update a variable in the mask
bitMask = (bitMask & ~(0xFF << 24)) + (199 << 24); // Updates variable_1 to 199
var variable_1 = ((bitMask >> 24) & 0xFF); // variable_1 == 199
This way bitMask variable only consumes 64 bits of memory but allows us to store 4 variables (each of which have a max value of 255).

External functions
Especially if the sports app tends to crash the watch the most effective way to avoid that is with external functions that are loaded from flash. E.g.,

ext1.js

function(value_1, value_2) {
  return value_1 + value_2;
}
ext2.js

function(value_1, value_2) {
  if (value2 < 1) return value_1;
  return value_2;
}
main.js

// This'll act as our function holder
var tmpFun;
// Creating a simple function def for loading external file from flash
var loadExt = function(ix) {
  tmpFun = undefined; // Make sure the variable is garbace collected
  return evalFile('{file_path}/ext' + ix + '.js');
}
//... other things here ...
function evaluate(input, output) {
  // something here...
  tmpFun = loadExt(1); // Loads the ext1.js function definition
  // Do something with the function
  var something = tmpFun(5, 123);
  // Load a new one
  tmpFun = loadExt(2);
  something = tmpFun(3,5);
  // etc.
  // something here...
}
// something here...
To shorten up the code even more you can exclude the tmpFun if you wish and do the following:

// Creating a simple function def for loading external file from flash
var loadExt = function(ix) {
  return evalFile('{file_path}/ext' + ix + '.js');
}
//... other things here ...
function evaluate(input, output) {
  // something here...
  // Load and execute the function
  var something = loadExt(1)(5, 123);
  // Load a new one and execute it
  something = loadExt(2)(3, 5);
  // etc.
  // something here...
}
// something here...
Errors
Watch crash/reboot
There might be several causes for this.

Watch crashes during the sports app load. This most likely happens due to running out of stack memory. Easiest way to fight this currently is to separate the code into several functions and load them from external files from flash memory only when they are needed. See above.
Sports app missing / Error message / Black screen
Again, there might be several causes for this.

Watch might be running out of heap memory. If so, try typed arrays, bitmasking or other similar methods.
Syntax errors in
JS code
HTML code
System events
ERR APPLICATION : ZappProvider::sub FAILED r:xxx l:xxxxx -> get

This means that a wrong type of request is being used. E.g., if a resource only supports "get" requests and the user tries to "subscribe", this error message pops up to sysevents.
ERR APPLICATION : Zapp [zapp name]: Exec. event x failed

Something went wrong executing an event. Could be a syntax error or undefined variable for example.
Events are referring to the callback events and below is a list of the events with the corresponding enumeration values
1: evaluate()
2: onLoad()
4: onLap()
8: onAutolap()
16: onInterval()
32: onPoolLength
128: onExerciseStart()
256: onExercisePause()
512: onExerciseContinue()
1024: onExerciseEnd()
2048: onActivityChange()
4096: getUserInterface()
16384: onEvent()
32768: onAccelerometer()
The following messages in system events indicate that app uses too much JavaScript memory.

#825585 05.07.2024 14:03:58 : ERR APPLICATION : Zapp: releaseMemoryCb (exec. zapp)
#825586 05.07.2024 14:03:58 : ERR APPLICATION : Zapp: ReleaseMem -> None avail.
The following messages in system events indicate that app uses too much HTML UI memory.

#144350 30.08.2023 18:16:19 : ERR APPLICATION : Zapp: releaseMemoryCb (exec. ui)
#144351 30.08.2023 18:16:19 : ERR APPLICATION : Zapp: ReleaseMem -> None avail.
Icons
UI1
Small icons
For icons in this set, use f-ico CSS class in HTML:

<div class="f-ico" style="top:calc(50% - 100%e);left:calc(50% - 50%e)">&#xF178;</div>

F100

F101

F102

F103

F104

F105

F106

F107

F108

F109

F110

F111

F112

F113

F114

F115

F116

F117

F118

F121

F122

F124

F125

F126

F128

F134

F135

F136

F137

F138

F139

F140

F144

F145

F146

F150

F157

F159

F160

F178

F183

F200

F228

F229

F230

F231

F239

F242

F244

F245

F248

F249

F252

F253

F254

F255

F256

F257

F258

F259

F260

F261

F262

F263

F264

F265

F266

F267

F268

F269

F270

F271

F272

F273

F274

F275

F277

F279

F280

F281

F282

F283

F284

F285

F286

F287

F288
Icons with round background
For icons in this set, use f-ico-m CSS class in HTML:

<div class="f-ico-m" style="top:calc(50% - 100%e);left:calc(50% - 50%e)">&#xE050;</div>

E001

E002

E003

E004

E005

E006

E007

E008

E009

E010

E011

E012

E013

E014

E015

E016

E017

E018

E019

E020

E021

E022

E023

E024

E025

E026

E027

E028

E029

E030

E031

E032

E033

E034

E035

E036

E037

E038

E039

E040

E041

E042

E043

E044

E045

E046

E047

E048

E049

E050

E051

E052

E053

E054

E055

E056

E057

E058

E059
 
 

E061

E062

E063

E064

E065

E066

E067

E068

E069

E070

E071

E072

E073

E074

E075

E076
 
 

E078

E079

E080

E081

E082

E083

E084

E085

E086

E087

E088

E089

E090

E091

E092

E093

E094

E095

E096

E097

E098

E099

E100

E101

E102

E103

E104

E105

E106

E107

E108

E109

E110

E111

E112

E113

E114

E115

E116

E117

E118

E121

E122

E124

E125

E126

E128

E134

E135

E136

E137

E138

E139

E140

E144

E145

E146

E150

E157

E159

E160

E178

E183

E200

E244

E245

E246

E247

E300

E301

E302

E303

E304

E305

E306

E307

E308

E309

E310

E311

E312

E313

E314

E315

E316

E317

E318

E319

E320

E321

E322

E323

E324

E325

E326

E327

E328

E329

E330

E331

E332

E333
Large icons
For icons in this set, use f-ico-l CSS class in HTML:

<div class="f-ico-l" style="top:calc(50% - 100%e);left:calc(50% - 50%e)">&#xF025;</div>

F001

F002

F003

F004

F005

F006

F007

F008

F009

F010

F011

F012

F013

F014

F015

F016

F017

F018

F019

F020

F021

F022

F023

F024

F025

F026

F027

F028

F029

F030

F031

F032

F033

F034

F035

F036

F037

F038

F039

F040

F041

F042

F043

F044

F045

F046

F047

F048

F049

F050

F051

F052

F053

F054

F055

F056

F057

F058

F059

F061

F062

F063

F064

F065

F066

F067

F068

F069

F070

F071

F072

F073

F074

F075

F076

F077

F078

F079

F080

F081

F082

F083

F084

F085

F086

F087

F088

F089

F090

F091

F092

F093

F094

F095

F096

F097

F098

F099

F280

F281

F282

F283

F284

F285

F286

F287

F288
UI2
Class Name	240 Pixel	280 Pixel	466 Pixel
.f-ico	20px	22px	38px
.f-ico-m	24px	28px	46px
.f-ico-l	32px	38px	62px
.f-ico-xl	64px	74px	124px
Small icons
For icons in this set, use f-ico CSS class in HTML:

<div class="f-ico" style="top:calc(50% - 100%e);left:calc(50% - 50%e)">&#xE300;</div>

E300

E301

E302

E303

E304

E305

E306

E307

E308

E309

E310

E311

E312

E313

E314

E315

E316

E317

E318

E319

E320

E321

E322

E323

E324

E325

E326

E327

E328

E329

E330

E331

E332

E333

E334

E335

E336

E337

E338

E339

E340

E341

E342

E343

E344

E345

E346

E347

E348

E349

E350

E351

E352

E353

E354

E355

E356

E357

E358

E359

E360

E361

E362

E363

E364

E365

E366

E367

E368

E369

E370

E371

E372

E373

F100

F101

F102

F103

F104

F105

F106

F107

F108

F109

F110

F111

F112

F113

F114

F115

F116

F117

F118

F119

F121

F122

F124

F125

F126

F128

F144

F145

F146

F147

F148

F149

F150

F151

F152

F153

F154

F159

F160

F171

F173

F178

F200

F201

F202

F203

F204

F205

F206

F207

F208

F229

F230

F231

F242

F244

F245

F252

F253

F254

F255

F256

F257

F258

F259

F260

F261

F262

F263

F264

F265

F266

F267

F268

F269

F270

F271

F272

F273

F274

F275

F277

F280

F281

F282

F283

F284

F285

F286

F287

F288

F304

F386

F387

F388

F389

F390

F392

F394

F396

F398

F400

F402

F404

F375

F377

F381

F376

F382

F380

F385

F384

F378

F406

F169

F170

F155

F156
Medium icons
For icons in this set, use f-ico-m CSS class in HTML:

<div class="f-ico-m" style="top:calc(50% - 100%e);left:calc(50% - 50%e)">&#xE001;</div>

E001

E002

E003

E004

E005

E006

E007

E008

E009

E010

E011

E012

E013

E014

E015

E016

E017

E018

E019

E020

E021

E022

E023

E024

E025

E026

E027

E028

E029

E030

E031

E032

E033

E034

E035

E036

E037

E038

E039

E040

E041

E042

E043

E044

E045

E046

E047

E048

E049

E050

E051

E052

E053

E054

E055

E056

E057

E058

E059

E060

E061

E062

E063

E064

E065

E066

E067

E068

E069

E070

E071

E072

E073

E074

E075

E076

E077

E078

E079

E080

E081

E082

E083

E084

E085

E086

E087

E088

E089

E090

E091

E092

E093

E094

E095

E096

E097

E098

E099

E100

E101

E102

E103

E104

E105

E106

E107

E108

E109

E110

E111

E112

F100

F101

F102

F103

F104

F105

F106

F107

F108

F109

F110

F111

F112

F113

F114

F115

F116

F117

F118

F119

F121

F122

F124

F125

F126

F128

F134

F135

F136

F137

F138

F139

F144

F145

F146

F159

F160

F178

F201

F202

F203

F204

F205

F206

F207

F208

F229

F230

F231

F242

F244

F245

F252

F253

F254

F255

F256

F257

F258

F259

F260

F261

F262

F263

F264

F265

F268

F269

F270

F271

F272

F273

F274

F275

F277

F280

F281

F282

F283

F284

F285

F286

F287

F288

F374

F375

F376

F377

F378

F379

F380

F381

F382

F383

F384

F385

F386

F387

F388

F389

F390

F392

F394

F396

F398

F400

F402

F404

F406
Large icons
For icons in this set, use f-ico-l CSS class in HTML:

<div class="f-ico-l" style="top:calc(50% - 100%e);left:calc(50% - 50%e)">&#xE001;</div>

E001

E002

E003

E004

E005

E006

E007

E008

E009

E010

E011

E012

E013

E014

E015

E016

E017

E018

E019

E020

E021

E022

E023

E024

E025

E026

E027

E028

E029

E030

E031

E032

E033

E034

E035

E036

E037

E038

E039

E040

E041

E042

E043

E044

E045

E046

E047

E048

E049

E050

E051

E052

E053

E054

E055

E056

E057

E058

E059

E060

E061

E062

E063

E064

E065

E066

E067

E068

E069

E070

E071

E072

E073

E074

E075

E076

E077

E078

E079

E080

E081

E082

E083

E084

E085

E086

E087

E088

E089

E090

E091

E092

E093

E094

E095

E096

E097

E098

E099

E100

E101

E102

E103

E104

E105

E106

E107

E108

E109

E110

E111

E112

E300

E301

E302

E303

E304

E305

E306

E307

E308

E309

E310

E311

E312

E313

E314

E315

E316

E317

E318

E319

E320

E321

E322

E323

E324

E325

E326

E327

E328

E329

E330

E331

E332

E333

E334

E335

E336

E337

E338

E339

E340

E341

E342

E343

E344

E345

E346

E347

E348

E349

E350

E351

E352

E353

E354

E355

E356

E357

E358

E359

E360

E361

E362

E363

E364

E365

E366

E367

E368

E369

E370

E371

E372

E373

F201

F202

F203

F204

F205

F206

F207

F208

F374

F375

F376

F377

F378

F379

F380

F381

F382

F383

F384

F385

F409

F410

F411

F412

F415

F416

F417

F418

F419

F420

F421

F422

F423

F424

F425

F426

F427

F428

F429

F430

F431

F432

F433

F434

F435

F436

F437

F438

F439

F440

F441

F442

F443

F444

F445
Extra large icons
For icons in this set, use f-ico-xl CSS class in HTML:

<div class="f-ico-xl" style="top:calc(50% - 100%e);left:calc(50% - 50%e)">&#xE300;</div>

E300

E301

E302

E303

E304

E305

E306

E307

E308

E309

E310

E311

E312

E313

E314

E315

E316

E317

E318

E319

E320

E321

E322

E323

E324

E325

E326

E327

E328

E329

E330

E331

E332

E333

E334

E335

E336

E337

E338

E339

E340

E341

E342

E343

E344

E345

E346

E347

E348

E349

E350

E351

E352

E353

E354

E355

E356

E357

E358

E359

E360

E361

E362

E363

E364

E365

E366

E367

E368

E369

E370

E371

E372

E373

F374

F375

F376

F377

F378

F379

F380

F381

F382

F383

F384

F385

F442

F410

F412

F409

F415

F416

F417

F418

F419

F420

F421

F422

F423

F424

F425

F426

F427

F428

F429

F430

F443

F431

F432

F440

F433

F434

F435

F436

F437

F438

F439

F411

F444

F445
Activity ID
1: Unspecified sport
2: Multisport
3: Running
4: Cycling
5: Mountain biking
6: Pool swimming
7: Gravel Cycling
8: Roller skating
9: Aerobics
10: Yoga / pilates
11: Trekking
12: Walking
13: Sailing
14: Kayaking
15: Rowing
16: Climbing
17: Indoor cycling
18: Circuit training
19: Triathlon
20: Alpine skiing
21: Snowboarding
22: Cross-country skiing
23: Weight training
24: Basketball
25: Soccer / football
26: Ice hockey
27: Volleyball
28: American football
29: Softball
30: Cheerleading
31: Baseball
32: Padel
33: Tennis
34: Badminton
35: Table tennis
36: Racquet ball
37: Squash
38: Martial arts
39: Boxing
40: Floorball
41: Mermaiding
42: Jump rope
43: Track running
44: Vertical running
45: Parkour
46: Skateboarding
47: Futsal
48: Field hockey
51: Scuba diving
52: Free diving
53: Snorkeling
54: Surfing
55: Swimrun
56: Duathlon
57: Aquathlon
58: Obstacle racing
59: Classic skiing
60: Skate skiing
61: Adventure racing
62: Bowling
63: Cricket
64: Crosstrainer
65: Dancing
66: Golf
67: Gymnastics
68: Handball
69: Horseback riding
70: Ice skating
71: Indoor rowing
72: Canoeing
73: Motorsports
74: Mountaineering
75: Orienteering
76: Rugby
77: Ski mountaineering
78: Ski touring
79: Stretching
80: Telemark skiing
81: Track and field
82: Trail running
83: Openwater swimming
84: Nordic walking
85: Snow shoeing
86: Windsurfing
87: Kettlebell
88: Roller skiing
89: Standup paddling
90: Crossfit
91: Kitesurfing / kiting
92: Paragliding
93: Treadmill
94: Frisbee
95: Indoor training
96: Hiking
97: Fishing
98: Hunting
99: Transition
100: Chores
101: Wheelchair sport
102: Pilates
103: Yoga
104: Calisthenics
105: E-biking
106: E-MTB
107: Cyclocross
108: Hand cycling
109: Backcountry skiing
110: Splitboarding
111: Biathlon
112: Meditation
Advanced formatters
Input values are formatted depending on Unit system setting in watch, as well as input value range.

Format specifiers:

h: hours
m: minutes
s: seconds
f: fractions of second
!: Inclusive value
?: Format is time (and not duration)
Available formatters:

AirPressure_Fivedigits (unit Pa):
Metric: value <= 99999.5 in unit hPa: 0 decimals
Imperial: value <= 999.95 in unit inHg: 2 decimals
AirPressure_Fourdigits (unit Pa):
Metric: value <= 9999.5 in unit hPa: 0 decimals
Imperial: value <= 99.95 in unit inHg: 2 decimals
AirPressure_Sixdigits (unit Pa):
Metric: value <= 999999.5 in unit hPa: 0 decimals
Imperial: value <= 9999.95 in unit inHg: 2 decimals
Altitude_Fivedigits (unit m):
Metric: value <= 99999.5 in unit m: 0 decimals
Imperial: value <= 99999.5 in unit ft: 0 decimals
Altitude_Fourdigits (unit m):
Metric:
value <= 9999.5 in unit m: 0 decimals
value <= 99999.5 in unit km: 2 decimals
Imperial:
value <= 9999.5 in unit ft: 0 decimals
value <= 99999.5 in unit kft: 2 decimals
Altitude_Sixdigits (unit m):
Metric: value <= 999999.5 in unit m: 0 decimals
Imperial: value <= 999999.5 in unit ft: 0 decimals
AscentDuration_Accurate (unit s):
value <= 3600: mm'ss.f
value <= 360000: !h:mm'ss
value <= 3600000: !h:mm
AscentDuration_Approximate (unit s):
value <= 60: ss
value <= 3600: mm
value <= 360000: !hh:mm
value <= 3600000: !h
AscentDuration_Fivedigits (unit s):
value <= 60: mm'ss.f
value <= 36000: !h:mm'ss
value <= 3600000: !hh:mm
AscentDuration_Fourdigits (unit s):
value <= 60: ss.f
value <= 3600: mm'ss
value <= 360000: !hh:mm
value <= 3600000: !h
AscentDuration_Sixdigits (unit s):
value <= 60: mm'ss.f
value <= 3600000: !h:mm'ss
AscentToWaypoint_Fivedigits (unit m):
Metric:
value <= 99999.5 in unit m: 0 decimals
value <= 999999.5 in unit km: 2 decimals
value <= 9999999.5 in unit km: 1 decimal
value <= 99999999.5 in unit km: 0 decimals
Imperial:
value <= 99999.5 in unit ft: 0 decimals
value <= 999999.5 in unit kft: 2 decimals
value <= 9999999.5 in unit kft: 1 decimal
value <= 99999999.5 in unit kft: 0 decimals
AscentToWaypoint_Fourdigits (unit m):
Metric:
value <= 9999.5 in unit m: 0 decimals
value <= 99999.5 in unit km: 2 decimals
value <= 999999.5 in unit km: 1 decimal
value <= 9999999.5 in unit km: 0 decimals
Imperial:
value <= 9999.5 in unit ft: 0 decimals
value <= 99999.5 in unit kft: 2 decimals
value <= 999999.5 in unit kft: 1 decimal
value <= 9999999.5 in unit kft: 0 decimals
AscentToWaypoint_Sixdigits (unit m):
Metric:
value <= 999999.5 in unit m: 0 decimals
value <= 9999999.5 in unit km: 2 decimals
value <= 99999999.5 in unit km: 1 decimal
value <= 999999999.5 in unit km: 0 decimals
Imperial:
value <= 999999.5 in unit ft: 0 decimals
value <= 9999999.5 in unit kft: 2 decimals
value <= 99999999.5 in unit kft: 1 decimal
value <= 999999999.5 in unit kft: 0 decimals
Ascent_Fivedigits (unit m):
Metric:
value <= 99999.5 in unit m: 0 decimals
value <= 999999.5 in unit km: 2 decimals
value <= 9999999.5 in unit km: 1 decimal
value <= 99999999.5 in unit km: 0 decimals
Imperial:
value <= 99999.5 in unit ft: 0 decimals
value <= 999999.5 in unit kft: 2 decimals
value <= 9999999.5 in unit kft: 1 decimal
value <= 99999999.5 in unit kft: 0 decimals
Ascent_Fourdigits (unit m):
Metric:
value <= 9999.5 in unit m: 0 decimals
value <= 99999.5 in unit km: 2 decimals
value <= 999999.5 in unit km: 1 decimal
value <= 9999999.5 in unit km: 0 decimals
Imperial:
value <= 9999.5 in unit ft: 0 decimals
value <= 99999.5 in unit kft: 2 decimals
value <= 999999.5 in unit kft: 1 decimal
value <= 9999999.5 in unit kft: 0 decimals
Ascent_Sixdigits (unit m):
Metric:
value <= 999999.5 in unit m: 0 decimals
value <= 9999999.5 in unit km: 2 decimals
value <= 99999999.5 in unit km: 1 decimal
value <= 999999999.5 in unit km: 0 decimals
Imperial:
value <= 999999.5 in unit ft: 0 decimals
value <= 9999999.5 in unit kft: 2 decimals
value <= 99999999.5 in unit kft: 1 decimal
value <= 999999999.5 in unit kft: 0 decimals
BatteryLeftDuration_Accurate (unit s):
value <= 3600: mm'ss.f
value <= 360000: !h:mm'ss
value <= 3600000: !h:mm
BatteryLeftDuration_Approximate (unit s):
value <= 60: ss
value <= 3600: mm
value <= 360000: !hh:mm
value <= 3600000: !h
BatteryLeftDuration_Fivedigits (unit s):
value <= 60: mm'ss.f
value <= 36000: !h:mm'ss
value <= 3600000: !hh:mm
BatteryLeftDuration_Fourdigits (unit s):
value <= 60: ss.f
value <= 3600: mm'ss
value <= 360000: !hh:mm
value <= 3600000: !h
BatteryLeftDuration_Sixdigits (unit s):
value <= 60: mm'ss.f
value <= 3600000: !h:mm'ss
BatteryPercentage_Fivedigits (unit %): value <= 9999.95 in unit %: 1 decimal
BatteryPercentage_Fourdigits (unit %): value <= 999.95 in unit %: 1 decimal
BatteryPercentage_Sixdigits (unit %): value <= 99999.95 in unit %: 1 decimal
BatteryPercentage_Threedigits (unit %): value <= 999.5 in unit %: 0 decimals
CadenceSpm_Fivedigits (unit Hz): value <= 999.5 in unit spm: 0 decimals
CadenceSpm_Fourdigits (unit Hz): value <= 999.5 in unit spm: 0 decimals
CadenceSpm_Sixdigits (unit Hz): value <= 999.5 in unit spm: 0 decimals
Cadence_Fivedigits (unit Hz): value <= 999.5 in unit rpm: 0 decimals
Cadence_Fourdigits (unit Hz): value <= 999.5 in unit rpm: 0 decimals
Cadence_Sixdigits (unit Hz): value <= 999.5 in unit rpm: 0 decimals
CompassHeadingDeg_Accurate (unit rad): value <= 360 in unit deg: 0 decimals
CompassHeadingDeg_Fivedigits (unit rad): value <= 360 in unit deg: 0 decimals
CompassHeadingDeg_Fourdigits (unit rad): value <= 360 in unit deg: 0 decimals
CompassHeadingDeg_Sixdigits (unit rad): value <= 360 in unit deg: 0 decimals
CompassHeadingMil_Fivedigits (unit rad): value <= 6400 in unit mil: 0 decimals
CompassHeadingMil_Fourdigits (unit rad): value <= 6400 in unit mil: 0 decimals
CompassHeadingMil_Sixdigits (unit rad): value <= 6400 in unit mil: 0 decimals
ContactTimeRatio_Fivedigits (unit %): value <= 9999.95 in unit %: 2 decimals
ContactTimeRatio_Fourdigits (unit %): value <= 999.95 in unit %: 2 decimals
ContactTimeRatio_Sixdigits (unit %): value <= 99999.95 in unit %: 2 decimals
ContactTime_Fivedigits (unit s): value <= 1999.5 in unit ms: 0 decimals
ContactTime_Fourdigits (unit s): value <= 1999.5 in unit ms: 0 decimals
ContactTime_Threedigits (unit s): value <= 999.5 in unit ms: 0 decimals
Count_Fivedigits: value <= 99999.5: 0 decimals
Count_Fourdigits: value <= 9999.5: 0 decimals
Count_Sixdigits: value <= 999999.5: 0 decimals
Count_Threedigits: value <= 999.5: 0 decimals
Count_Twodigits: value <= 99.5: 0 decimals
Declination_Fivedigits (unit rad): value <= 90.05 in unit deg: 1 decimal
Declination_Fourdigits (unit rad): value <= 90.05 in unit deg: 1 decimal
Declination_Sixdigits (unit rad): value <= 90.05 in unit deg: 1 decimal
DescentDuration_Accurate (unit s):
value <= 3600: mm'ss.f
value <= 360000: !h:mm'ss
value <= 3600000: !h:mm
DescentDuration_Approximate (unit s):
value <= 60: ss
value <= 3600: mm
value <= 360000: !hh:mm
value <= 3600000: !h
DescentDuration_Fivedigits (unit s):
value <= 60: mm'ss.f
value <= 36000: !h:mm'ss
value <= 3600000: !hh:mm
DescentDuration_Fourdigits (unit s):
value <= 60: ss.f
value <= 3600: mm'ss
value <= 360000: !hh:mm
value <= 3600000: !h
DescentDuration_Sixdigits (unit s):
value <= 60: mm'ss.f
value <= 3600000: !h:mm'ss
DescentToWaypoint_Fivedigits (unit m):
Metric:
value <= 99999.5 in unit m: 0 decimals
value <= 999999.5 in unit km: 2 decimals
value <= 9999999.5 in unit km: 1 decimal
value <= 99999999.5 in unit km: 0 decimals
Imperial:
value <= 99999.5 in unit ft: 0 decimals
value <= 999999.5 in unit kft: 2 decimals
value <= 9999999.5 in unit kft: 1 decimal
value <= 99999999.5 in unit kft: 0 decimals
DescentToWaypoint_Fourdigits (unit m):
Metric:
value <= 9999.5 in unit m: 0 decimals
value <= 99999.5 in unit km: 2 decimals
value <= 999999.5 in unit km: 1 decimal
value <= 9999999.5 in unit km: 0 decimals
Imperial:
value <= 9999.5 in unit ft: 0 decimals
value <= 99999.5 in unit kft: 2 decimals
value <= 999999.5 in unit kft: 1 decimal
value <= 9999999.5 in unit kft: 0 decimals
DescentToWaypoint_Sixdigits (unit m):
Metric:
value <= 999999.5 in unit m: 0 decimals
value <= 9999999.5 in unit km: 2 decimals
value <= 99999999.5 in unit km: 1 decimal
value <= 999999999.5 in unit km: 0 decimals
Imperial:
value <= 999999.5 in unit ft: 0 decimals
value <= 9999999.5 in unit kft: 2 decimals
value <= 99999999.5 in unit kft: 1 decimal
value <= 999999999.5 in unit kft: 0 decimals
Descent_Fivedigits (unit m):
Metric:
value <= 99999.5 in unit m: 0 decimals
value <= 999999.5 in unit km: 2 decimals
value <= 9999999.5 in unit km: 1 decimal
value <= 99999999.5 in unit km: 0 decimals
Imperial:
value <= 99999.5 in unit ft: 0 decimals
value <= 999999.5 in unit kft: 2 decimals
value <= 9999999.5 in unit kft: 1 decimal
value <= 99999999.5 in unit kft: 0 decimals
Descent_Fourdigits (unit m):
Metric:
value <= 9999.5 in unit m: 0 decimals
value <= 99999.5 in unit km: 2 decimals
value <= 999999.5 in unit km: 1 decimal
value <= 9999999.5 in unit km: 0 decimals
Imperial:
value <= 9999.5 in unit ft: 0 decimals
value <= 99999.5 in unit kft: 2 decimals
value <= 999999.5 in unit kft: 1 decimal
value <= 9999999.5 in unit kft: 0 decimals
Descent_Sixdigits (unit m):
Metric:
value <= 999999.5 in unit m: 0 decimals
value <= 9999999.5 in unit km: 2 decimals
value <= 99999999.5 in unit km: 1 decimal
value <= 999999999.5 in unit km: 0 decimals
Imperial:
value <= 999999.5 in unit ft: 0 decimals
value <= 9999999.5 in unit kft: 2 decimals
value <= 99999999.5 in unit kft: 1 decimal
value <= 999999999.5 in unit kft: 0 decimals
Distance_Accumulated (unit m):
Metric:
value <= 99950 in unit km: 1 decimal
value <= 999999500 in unit km: 0 decimals
Imperial:
value <= 99.95 in unit mi: 1 decimal
value <= 621370 in unit mi: 0 decimals
Distance_Accurate (unit m):
Metric:
value <= 999.5 in unit m: 0 decimals
value <= 99995 in unit km: 2 decimals
value <= 9999950 in unit km: 1 decimal
value <= 99999500 in unit km: 0 decimals
Imperial:
value <= 0.1 in unit ft: 0 decimals
value <= 99.995 in unit mi: 2 decimals
value <= 9999.95 in unit mi: 1 decimal
value <= 99999.5 in unit mi: 0 decimals
Distance_Approximate (unit m):
Metric:
value <= 99.5 in unit m: 0 decimals
value <= 9950 in unit km: 1 decimal
value <= 99999500 in unit km: 0 decimals
Imperial:
value <= 0.1 in unit ft: 0 decimals
value <= 9.95 in unit mi: 1 decimal
value <= 99999.5 in unit mi: 0 decimals
Distance_Fivedigits (unit m):
Metric:
value <= 999950 in unit km: 2 decimals
value <= 9999500 in unit km: 1 decimal
Imperial:
value <= 999.995 in unit mi: 2 decimals
value <= 9999.95 in unit mi: 1 decimal
Distance_Fourdigits (unit m):
Metric:
value <= 99995 in unit km: 2 decimals
value <= 999950 in unit km: 1 decimal
value <= 9999500 in unit km: 0 decimals
Imperial:
value <= 99.995 in unit mi: 2 decimals
value <= 999.95 in unit mi: 1 decimal
value <= 9999.5 in unit mi: 0 decimals
Distance_Nodecimal (unit m):
Metric: value <= 99999500 in unit km: 0 decimals
Imperial: value <= 621370 in unit mi: 0 decimals
Distance_Onedecimal (unit m):
Metric: value <= 99999950 in unit km: 1 decimal
Imperial: value <= 621370 in unit mi: 1 decimal
Distance_Sixdigits (unit m):
Metric: value <= 9999500 in unit km: 2 decimals
Imperial:
value <= 9999.995 in unit mi: 2 decimals
value <= 99999.95 in unit mi: 1 decimal
value <= 621370 in unit mi: 0 decimals
Distance_Threedigits (unit m):
Metric:
value <= 999.5 in unit m: 0 decimals
value <= 9995 in unit km: 2 decimals
value <= 99950 in unit km: 1 decimal
value <= 999500 in unit km: 0 decimals
Imperial:
value <= 0.1 in unit ft: 0 decimals
value <= 9.995 in unit mi: 2 decimals
value <= 99.95 in unit mi: 1 decimal
value <= 999.5 in unit mi: 0 decimals
DownhillAltitude_Fivedigits (unit m):
Metric: value <= 99999.5 in unit m: 0 decimals
Imperial: value <= 99999.5 in unit ft: 0 decimals
DownhillAltitude_Fourdigits (unit m):
Metric:
value <= 9999.5 in unit m: 0 decimals
value <= 99999.5 in unit km: 2 decimals
Imperial:
value <= 9999.5 in unit ft: 0 decimals
value <= 99999.5 in unit kft: 2 decimals
DownhillAltitude_Sixdigits (unit m):
Metric: value <= 999999.5 in unit m: 0 decimals
Imperial: value <= 999999.5 in unit ft: 0 decimals
DownhillDescent_Fivedigits (unit m):
Metric:
value <= 99999.5 in unit m: 0 decimals
value <= 999999.5 in unit km: 2 decimals
value <= 9999999.5 in unit km: 1 decimal
value <= 99999999.5 in unit km: 0 decimals
Imperial:
value <= 99999.5 in unit ft: 0 decimals
value <= 999999.5 in unit kft: 2 decimals
value <= 9999999.5 in unit kft: 1 decimal
value <= 99999999.5 in unit kft: 0 decimals
DownhillDescent_Fourdigits (unit m):
Metric:
value <= 9999.5 in unit m: 0 decimals
value <= 99999.5 in unit km: 2 decimals
value <= 999999.5 in unit km: 1 decimal
value <= 9999999.5 in unit km: 0 decimals
Imperial:
value <= 9999.5 in unit ft: 0 decimals
value <= 99999.5 in unit kft: 2 decimals
value <= 999999.5 in unit kft: 1 decimal
value <= 9999999.5 in unit kft: 0 decimals
DownhillDescent_Sixdigits (unit m):
Metric:
value <= 999999.5 in unit m: 0 decimals
value <= 9999999.5 in unit km: 2 decimals
value <= 99999999.5 in unit km: 1 decimal
value <= 999999999.5 in unit km: 0 decimals
Imperial:
value <= 999999.5 in unit ft: 0 decimals
value <= 9999999.5 in unit kft: 2 decimals
value <= 99999999.5 in unit kft: 1 decimal
value <= 999999999.5 in unit kft: 0 decimals
DownhillDistance_Accurate (unit m):
Metric:
value <= 999.5 in unit m: 0 decimals
value <= 99995 in unit km: 2 decimals
value <= 9999950 in unit km: 1 decimal
value <= 99999500 in unit km: 0 decimals
Imperial:
value <= 0.1 in unit ft: 0 decimals
value <= 99.995 in unit mi: 2 decimals
value <= 9999.95 in unit mi: 1 decimal
value <= 99999.5 in unit mi: 0 decimals
DownhillDistance_Approximate (unit m):
Metric:
value <= 99.5 in unit m: 0 decimals
value <= 9999.5 in unit km: 1 decimal
value <= 99999500 in unit km: 0 decimals
Imperial:
value <= 0.1 in unit ft: 0 decimals
value <= 9.95 in unit mi: 1 decimal
value <= 99999.5 in unit mi: 0 decimals
DownhillDistance_Fivedigits (unit m):
Metric:
value <= 999950 in unit km: 2 decimals
value <= 9999500 in unit km: 1 decimal
Imperial:
value <= 999.95 in unit mi: 2 decimals
value <= 9999.5 in unit mi: 1 decimal
DownhillDistance_Fourdigits (unit m):
Metric:
value <= 99995 in unit km: 2 decimals
value <= 999950 in unit km: 1 decimal
value <= 9999500 in unit km: 0 decimals
Imperial:
value <= 9.995 in unit mi: 2 decimals
value <= 999.95 in unit mi: 1 decimal
value <= 9999.5 in unit mi: 0 decimals
DownhillDistance_Sixdigits (unit m):
Metric: value <= 9999500 in unit km: 2 decimals
Imperial: value <= 9999.5 in unit mi: 2 decimals
DownhillDistance_Threedigits (unit m):
Metric:
value <= 999.5 in unit m: 0 decimals
value <= 9995 in unit km: 2 decimals
value <= 99950 in unit km: 1 decimal
value <= 999500 in unit km: 0 decimals
Imperial:
value <= 0.1 in unit ft: 0 decimals
value <= 9.995 in unit mi: 2 decimals
value <= 99.95 in unit mi: 1 decimal
value <= 999.5 in unit mi: 0 decimals
DownhillDuration_Approximate (unit s):
value <= 60: ss
value <= 3600: mm
value <= 360000: !hh:mm
value <= 3600000: !h
DownhillDuration_Fivedigits (unit s):
value <= 60: mm'ss.f
value <= 36000: !h:mm'ss
value <= 3600000: !hh:mm
DownhillDuration_Fourdigits (unit s):
value <= 60: ss.f
value <= 3600: mm'ss
value <= 360000: !hh:mm
value <= 3600000: !h
DownhillDuration_FourdigitsFixed (unit s):
value <= 3600: mm'ss
value <= 360000: !hh:mm
DownhillDuration_Sixdigits (unit s):
value <= 60: mm'ss.f
value <= 3600000: !h:mm'ss
DownhillDuration_Training (unit s):
value <= 60: mm'ss.f
value <= 360000: !h:mm'ss
value <= 3600000: !h:mm
DownhillGrade_Fivedigits (unit %): value <= 9999.95 in unit %: 1 decimal
DownhillGrade_Fourdigits (unit %): value <= 999.95 in unit %: 1 decimal
DownhillGrade_Sixdigits (unit %): value <= 99999.95 in unit %: 1 decimal
DownhillGrade_Threedigits (unit %): value <= 999.5 in unit %: 0 decimals
DownhillGrade_Twodigits (unit %): value <= 99.5 in unit %: 0 decimals
DownhillLapCount_Fivedigits: value <= 99999.5: 0 decimals
DownhillLapCount_Fourdigits: value <= 9999.5: 0 decimals
DownhillLapCount_Sixdigits: value <= 999999.5: 0 decimals
DownhillLapCount_Threedigits: value <= 999.5: 0 decimals
DownhillSpeed_Approximate (unit m/s):
Metric: value <= 999.5 in unit km/h: 0 decimals
Imperial: value <= 999.5 in unit mi/h: 0 decimals
DownhillSpeed_Fivedigits (unit m/s):
Metric: value <= 9999.95 in unit km/h: 1 decimal
Imperial: value <= 9999.95 in unit mi/h: 1 decimal
DownhillSpeed_Fourdigits (unit m/s):
Metric: value <= 999.95 in unit km/h: 1 decimal
Imperial: value <= 999.95 in unit mi/h: 1 decimal
DownhillSpeed_Sixdigits (unit m/s):
Metric: value <= 99999.95 in unit km/h: 1 decimal
Imperial: value <= 99999.95 in unit mi/h: 1 decimal
DownhillSpeed_Threedigits (unit m/s):
Metric:
value <= 99.95 in unit km/h: 1 decimal
value <= 999.5 in unit km/h: 0 decimals
Imperial:
value <= 99.95 in unit mi/h: 1 decimal
value <= 999.5 in unit mi/h: 0 decimals
DurationMs_Accurate (unit ms):
value <= 3600: mm'ss.f
value <= 360000: !hh:mm'ss
DurationMs_Approximate (unit ms):
value <= 60: ss
value <= 3600: mm
value <= 360000: !hh:mm
DurationMs_Fivedigits (unit ms):
value <= 3600: mm'ss.f
value <= 36000: !h:mm'ss
value <= 360000: !hh:mm
DurationMs_Fourdigits (unit ms):
value <= 60: ss.f
value <= 3600: mm'ss
value <= 360000: !hh:mm
DurationMs_Sixdigits (unit ms):
value <= 3600: mm'ss.f
value <= 360000: !h:mm'ss
Duration_Accumulated (unit s):
value <= 3600000: !h:mm
value <= 3600000000: !h
Duration_Accurate (unit s):
value <= 3600: mm'ss.f
value <= 360000: !h:mm'ss
value <= 3600000: !h:mm
Duration_Approximate (unit s):
value <= 60: ss
value <= 3600: mm
value <= 360000: !hh:mm
value <= 3600000: !h
Duration_Fivedigits (unit s):
value <= 60: mm'ss.f
value <= 36000: !h:mm'ss
value <= 3600000: !hh:mm
Duration_Fixed (unit s): value <= 3600000: !hh:mm
Duration_FixedNoLeadingZero (unit s): value <= 360000: !h:mm
Duration_Fourdigits (unit s):
value <= 60: ss.f
value <= 3600: mm'ss
value <= 360000: !hh:mm
value <= 3600000: !h
Duration_FourdigitsFixed (unit s):
value <= 3600: mm'ss
value <= 360000: !hh:mm
Duration_Hours (unit s): value <= 3600000: !h
Duration_Humane (unit s):
value <= 60: '!s
value <= 3600: !m'ss
value <= 3600000: !h:mm
Duration_Minutes (unit s): value <= 360000: !m
Duration_Nodecimal (unit s): value <= 3600000: !h:mm'ss
Duration_OnlyMinutes (unit s):
value <= 5999: !m'
value <= 3600000: 99'
Duration_Sixdigits (unit s):
value <= 60: mm'ss.f
value <= 3600000: !h:mm'ss
Duration_SurfaceTime (unit s): value <= 86400: !h:mm
Duration_ThreedigitsFixed (unit s):
value <= 36000: !h:mm
value <= 3600000: !h
Duration_Training (unit s):
value <= 60: mm'ss.f
value <= 360000: !h:mm'ss
value <= 3600000: !h:mm
Duration_Yielding (unit s):
value <= 3600: !m'ss
value <= 86400: !h:mm
EPOC_Fivedigits: value <= 999.5: 0 decimals
EPOC_Fourdigits: value <= 999.5: 0 decimals
EPOC_Sixdigits: value <= 999.5: 0 decimals
Energy_Accumulated (unit J): value <= 99999999.5 in unit kcal: 0 decimals
Energy_Fivedigits (unit J): value <= 99999.5 in unit kcal: 0 decimals
Energy_Fourdigits (unit J): value <= 9999.5 in unit kcal: 0 decimals
Energy_Sixdigits (unit J): value <= 999999.5 in unit kcal: 0 decimals
ExerciseDuration_Accumulated (unit s):
value <= 3600000: !h:mm
value <= 3600000000: !h
ExerciseDuration_Accurate (unit s):
value <= 3600: mm'ss.f
value <= 360000: !h:mm'ss
value <= 3600000: !h:mm
ExerciseDuration_Approximate (unit s):
value <= 60: ss
value <= 3600: mm
value <= 360000: !hh:mm
value <= 3600000: !h
ExerciseDuration_Fivedigits (unit s):
value <= 60: mm'ss.f
value <= 36000: !h:mm'ss
value <= 3600000: !hh:mm
ExerciseDuration_Fixed (unit s): value <= 3600000: !hh:mm
ExerciseDuration_FixedNoLeadingZero (unit s): value <= 360000: !h:mm
ExerciseDuration_Fourdigits (unit s):
value <= 60: ss.f
value <= 3600: mm'ss
value <= 360000: !hh:mm
value <= 3600000: !h
ExerciseDuration_FourdigitsFixed (unit s):
value <= 3600: mm'ss
value <= 360000: !hh:mm
ExerciseDuration_Hours (unit s): value <= 3600000: !h
ExerciseDuration_Humane (unit s):
value <= 60: '!s
value <= 3600: !m'ss
value <= 3600000: !h:mm
ExerciseDuration_Minutes (unit s): value <= 360000: !m
ExerciseDuration_Nodecimal (unit s): value <= 3600000: !h:mm'ss
ExerciseDuration_OnlyMinutes (unit s):
value <= 5999: !m'
value <= 3600000: 99'
ExerciseDuration_Sixdigits (unit s):
value <= 60: mm'ss.f
value <= 3600000: !h:mm'ss
ExerciseDuration_SurfaceTime (unit s): value <= 86400: !h:mm
ExerciseDuration_ThreedigitsFixed (unit s):
value <= 36000: !h:mm
value <= 3600000: !h
ExerciseDuration_Training (unit s):
value <= 60: mm'ss.f
value <= 360000: !h:mm'ss
value <= 3600000: !h:mm
ExerciseDuration_Yielding (unit s):
value <= 3600: !m'ss
value <= 86400: !h:mm
FlightTime_Fourdigits (unit s): value <= 2000 in unit ms: 0 decimals
FlowRate_Ventilation (unit l/min):
Metric: value <= 999.9 in unit l/min: 1 decimal
Imperial: value <= 999.99 in unit cuft/min: 2 decimals
HeartRatePercentage_Fivedigits (unit %): value <= 9999.95 in unit %: 1 decimal
HeartRatePercentage_Fourdigits (unit %): value <= 999.95 in unit %: 1 decimal
HeartRatePercentage_Sixdigits (unit %): value <= 99999.95 in unit %: 1 decimal
HeartRatePercentage_Threedigits (unit %): value <= 999.5 in unit %: 0 decimals
HeartRateZone_Fivedigits: value <= 99999.5: 0 decimals
HeartRateZone_Fourdigits: value <= 9999.5: 0 decimals
HeartRateZone_Sixdigits: value <= 999999.5: 0 decimals
HeartRateZone_Threedigits: value <= 999.5: 0 decimals
HeartRateZone_Twodigits: value <= 99.5: 0 decimals
HeartRate_Fivedigits (unit Hz): value <= 999.5 in unit bpm: 0 decimals
HeartRate_Fourdigits (unit Hz): value <= 999.5 in unit bpm: 0 decimals
HeartRate_Sixdigits (unit Hz): value <= 999.5 in unit bpm: 0 decimals
NauticalDistance_Fivedigits (unit m):
value <= 999.95 in unit nmi: 2 decimals
value <= 9999.5 in unit nmi: 1 decimal
NauticalDistance_Fourdigits (unit m):
value <= 9.995 in unit nmi: 2 decimals
value <= 999.95 in unit nmi: 1 decimal
value <= 9999.5 in unit nmi: 0 decimals
NauticalDistance_Sixdigits (unit m): value <= 9999.5 in unit nmi: 2 decimals
NauticalDistance_Threedigits (unit m):
value <= 9.995 in unit nmi: 2 decimals
value <= 99.95 in unit nmi: 1 decimal
value <= 999.5 in unit nmi: 0 decimals
NauticalSpeed_Approximate (unit m/s): value <= 999.5 in unit kn: 0 decimals
NauticalSpeed_Fivedigits (unit m/s): value <= 9999.95 in unit kn: 1 decimal
NauticalSpeed_Fourdigits (unit m/s): value <= 999.95 in unit kn: 1 decimal
NauticalSpeed_Sixdigits (unit m/s): value <= 99999.95 in unit kn: 1 decimal
NauticalSpeed_Threedigits (unit m/s):
value <= 99.95 in unit kn: 1 decimal
value <= 999.5 in unit kn: 0 decimals
NavigationPOIDistance_Fivedigits (unit m):
Metric:
value <= 999950 in unit km: 2 decimals
value <= 9999500 in unit km: 1 decimal
Imperial:
value <= 999.95 in unit mi: 2 decimals
value <= 9999.5 in unit mi: 1 decimal
NavigationPOIDistance_Fourdigits (unit m):
Metric:
value <= 999.5 in unit m: 0 decimals
value <= 99995 in unit km: 2 decimals
value <= 999950 in unit km: 1 decimal
value <= 9999500 in unit km: 0 decimals
Imperial:
value <= 0.1 in unit ft: 0 decimals
value <= 9.995 in unit mi: 2 decimals
value <= 999.95 in unit mi: 1 decimal
value <= 9999.5 in unit mi: 0 decimals
NavigationPOIDistance_Sixdigits (unit m):
Metric: value <= 9999500 in unit km: 2 decimals
Imperial: value <= 9999.5 in unit mi: 2 decimals
NavigationPOIDistance_Threedigits (unit m):
Metric:
value <= 999.5 in unit m: 0 decimals
value <= 9995 in unit km: 2 decimals
value <= 99950 in unit km: 1 decimal
value <= 999500 in unit km: 0 decimals
Imperial:
value <= 0.1 in unit ft: 0 decimals
value <= 9.995 in unit mi: 2 decimals
value <= 99.95 in unit mi: 1 decimal
value <= 999.5 in unit mi: 0 decimals
NavigationPoiETA_Fivedigits (unit s): ?h:mm
NavigationPoiETA_Fourdigits (unit s): ?h:mm
NavigationPoiETA_Sixdigits (unit s): ?h:mm
NavigationPoiETE_Fivedigits (unit s):
value <= 60: mm'ss.f
value <= 36000: !h:mm'ss
value <= 3600000: !hh:mm
NavigationPoiETE_Fixed (unit s): value <= 3600000: !hh:mm
NavigationPoiETE_FixedNoLeadingZero (unit s): value <= 360000: !h:mm
NavigationPoiETE_Fourdigits (unit s):
value <= 60: ss.f
value <= 3600: mm'ss
value <= 360000: !hh:mm
value <= 3600000: !h
NavigationPoiETE_FourdigitsFixed (unit s):
value <= 3600: mm'ss
value <= 360000: !hh:mm
NavigationPoiETE_Hours (unit s): value <= 3600000: !h
NavigationPoiETE_Humane (unit s):
value <= 60: '!s
value <= 3600: !m'ss
value <= 3600000: !h:mm
NavigationPoiETE_Minutes (unit s): value <= 360000: !m
NavigationPoiETE_Sixdigits (unit s):
value <= 60: mm'ss.f
value <= 3600000: !h:mm'ss
NavigationRouteDistance_Fivedigits (unit m):
Metric:
value <= 999950 in unit km: 2 decimals
value <= 9999500 in unit km: 1 decimal
Imperial:
value <= 999.95 in unit mi: 2 decimals
value <= 9999.5 in unit mi: 1 decimal
NavigationRouteDistance_Fourdigits (unit m):
Metric:
value <= 999.5 in unit m: 0 decimals
value <= 99995 in unit km: 2 decimals
value <= 999950 in unit km: 1 decimal
value <= 9999500 in unit km: 0 decimals
Imperial:
value <= 0.1 in unit ft: 0 decimals
value <= 9.995 in unit mi: 2 decimals
value <= 999.95 in unit mi: 1 decimal
value <= 9999.5 in unit mi: 0 decimals
NavigationRouteDistance_Sixdigits (unit m):
Metric: value <= 9999500 in unit km: 2 decimals
Imperial: value <= 9999.5 in unit mi: 2 decimals
NavigationRouteDistance_Threedigits (unit m):
Metric:
value <= 999.5 in unit m: 0 decimals
value <= 9995 in unit km: 2 decimals
value <= 99950 in unit km: 1 decimal
value <= 999500 in unit km: 0 decimals
Imperial:
value <= 0.1 in unit ft: 0 decimals
value <= 9.995 in unit mi: 2 decimals
value <= 99.95 in unit mi: 1 decimal
value <= 999.5 in unit mi: 0 decimals
NavigationRouteETA_Fivedigits (unit s): ?h:mm
NavigationRouteETA_Fourdigits (unit s): ?h:mm
NavigationRouteETA_Sixdigits (unit s): ?h:mm
NavigationRouteETE_Fivedigits (unit s):
value <= 60: mm'ss.f
value <= 36000: !h:mm'ss
value <= 3600000: !hh:mm
NavigationRouteETE_Fixed (unit s): value <= 3600000: !hh:mm
NavigationRouteETE_FixedNoLeadingZero (unit s): value <= 360000: !h:mm
NavigationRouteETE_Fourdigits (unit s):
value <= 60: ss.f
value <= 3600: mm'ss
value <= 360000: !hh:mm
value <= 3600000: !h
NavigationRouteETE_FourdigitsFixed (unit s):
value <= 3600: mm'ss
value <= 360000: !hh:mm
NavigationRouteETE_Hours (unit s): value <= 3600000: !h
NavigationRouteETE_Humane (unit s):
value <= 60: '!s
value <= 3600: !m'ss
value <= 3600000: !h:mm
NavigationRouteETE_Minutes (unit s): value <= 360000: !m
NavigationRouteETE_Sixdigits (unit s):
value <= 60: mm'ss.f
value <= 3600000: !h:mm'ss
NormalizedGradedPace_Fivedigits (unit m/s):
Metric: value <= 1799.5 in unit s/km: !mm'ss
Imperial: value <= 59999.5 in unit s/mi: !mm'ss
NormalizedGradedPace_FixedNoLeadingZero (unit m/s):
Metric: value <= 1799.5 in unit s/km: !m'ss
Imperial: value <= 599999.5 in unit s/mi: !m'ss
NormalizedGradedPace_Fourdigits (unit m/s):
Metric: value <= 1799.5 in unit s/km: !mm'ss
Imperial: value <= 5999.5 in unit s/mi: !mm'ss
NormalizedGradedPace_Sixdigits (unit m/s):
Metric: value <= 1799.5 in unit s/km: !mm'ss
Imperial: value <= 599999.5 in unit s/mi: !mm'ss
OneDecimal_Fourdigits: value <= 999.9: 1 decimal
PaceZone_Fivedigits: value <= 99999.5: 0 decimals
PaceZone_Fourdigits: value <= 9999.5: 0 decimals
PaceZone_Sixdigits: value <= 999999.5: 0 decimals
PaceZone_Threedigits: value <= 999.5: 0 decimals
PaceZone_Twodigits: value <= 99.5: 0 decimals
Pace_Fivedigits (unit m/s):
Metric: value <= 1799.5 in unit s/km: !mm'ss
Imperial: value <= 59999.5 in unit s/mi: !mm'ss
Pace_FixedNoLeadingZero (unit m/s):
Metric: value <= 1799.5 in unit s/km: !m'ss
Imperial: value <= 599999.5 in unit s/mi: !m'ss
Pace_Fourdigits (unit m/s):
Metric: value <= 1799.5 in unit s/km: !mm'ss
Imperial: value <= 5999.5 in unit s/mi: !mm'ss
Pace_Sixdigits (unit m/s):
Metric: value <= 1799.5 in unit s/km: !mm'ss
Imperial: value <= 599999.5 in unit s/mi: !mm'ss
PauseTime_Accurate (unit s):
value <= 3600: mm'ss.f
value <= 360000: !h:mm'ss
value <= 3600000: !h:mm
PauseTime_Approximate (unit s):
value <= 60: ss
value <= 3600: mm
value <= 360000: !hh:mm
value <= 3600000: !h
PauseTime_Fivedigits (unit s):
value <= 60: mm'ss.f
value <= 36000: !h:mm'ss
value <= 3600000: !hh:mm
PauseTime_Fourdigits (unit s):
value <= 60: ss.f
value <= 3600: mm'ss
value <= 360000: !hh:mm
value <= 3600000: !h
PauseTime_Sixdigits (unit s):
value <= 60: mm'ss.f
value <= 3600000: !h:mm'ss
PeakTrainingEffect_Fivedigits: value <= 5.05: 1 decimal
PeakTrainingEffect_Fourdigits: value <= 5.05: 1 decimal
PeakTrainingEffect_Sixdigits: value <= 5.05: 1 decimal
Percentage_Fivedigits (unit %): value <= 9999.95 in unit %: 1 decimal
Percentage_Fourdigits (unit %): value <= 999.95 in unit %: 1 decimal
Percentage_Sixdigits (unit %): value <= 99999.95 in unit %: 1 decimal
Percentage_Threedigits (unit %): value <= 999.5 in unit %: 0 decimals
Performance_Fivedigits: value <= 99.5: 0 decimals
Performance_Fourdigits: value <= 99.5: 0 decimals
Performance_Sixdigits: value <= 99.5: 0 decimals
PowerZone_Fivedigits: value <= 99999.5: 0 decimals
PowerZone_Fourdigits: value <= 9999.5: 0 decimals
PowerZone_Sixdigits: value <= 999999.5: 0 decimals
PowerZone_Threedigits: value <= 999.5: 0 decimals
PowerZone_Twodigits: value <= 99.5: 0 decimals
Power_Accurate (unit W): value <= 9999.5 in unit W: 0 decimals
Power_Fivedigits (unit W): value <= 99999.5 in unit W: 0 decimals
Power_Fourdigits (unit W): value <= 9999.5 in unit W: 0 decimals
Power_Sixdigits (unit W): value <= 999999.5 in unit W: 0 decimals
Reactivity_Onedigit: value <= 2: 2 decimals
RecoveryTime_Fivedigits (unit s): value <= 120.1 in unit h: 0 decimals
RecoveryTime_Fourdigits (unit s): value <= 120.1 in unit h: 0 decimals
RecoveryTime_Sixdigits (unit s): value <= 120.1 in unit h: 0 decimals
Repetitions_Fivedigits: value <= 99999.5: 0 decimals
Repetitions_Fourdigits: value <= 9999.5: 0 decimals
Repetitions_Sixdigits: value <= 999999.5: 0 decimals
Repetitions_Threedigits: value <= 999.5: 0 decimals
RestTime_Accurate (unit s):
value <= 3600: mm'ss.f
value <= 360000: !h:mm'ss
value <= 3600000: !h:mm
RestTime_Approximate (unit s):
value <= 60: ss
value <= 3600: mm
value <= 360000: !hh:mm
value <= 3600000: !h
RestTime_Fivedigits (unit s):
value <= 60: mm'ss.f
value <= 36000: !h:mm'ss
value <= 3600000: !hh:mm
RestTime_Fourdigits (unit s):
value <= 60: ss.f
value <= 3600: mm'ss
value <= 360000: !hh:mm
value <= 3600000: !h
RestTime_Sixdigits (unit s):
value <= 60: mm'ss.f
value <= 3600000: !h:mm'ss
RowingPace_Fivedigits (unit m/s):
Metric: value <= 59999.5 in unit s/500m: !mm'ss
Imperial: value <= 59999.5 in unit s/mi: !mm'ss
RowingPace_FixedNoLeadingZero (unit m/s):
Metric: value <= 599999.5 in unit s/500m: !m'ss
Imperial: value <= 599999.5 in unit s/mi: !m'ss
RowingPace_Fourdigits (unit m/s):
Metric: value <= 5999.5 in unit s/500m: !mm'ss
Imperial: value <= 5999.5 in unit s/mi: !mm'ss
RowingPace_Sixdigits (unit m/s):
Metric: value <= 599999.5 in unit s/500m: !mm'ss
Imperial: value <= 599999.5 in unit s/mi: !mm'ss
Speed_Approximate (unit m/s):
Metric: value <= 999.5 in unit km/h: 0 decimals
Imperial: value <= 999.5 in unit mi/h: 0 decimals
Speed_Fivedigits (unit m/s):
Metric: value <= 9999.95 in unit km/h: 1 decimal
Imperial: value <= 9999.95 in unit mi/h: 1 decimal
Speed_Fourdigits (unit m/s):
Metric: value <= 999.95 in unit km/h: 1 decimal
Imperial: value <= 999.95 in unit mi/h: 1 decimal
Speed_Sixdigits (unit m/s):
Metric: value <= 99999.95 in unit km/h: 1 decimal
Imperial: value <= 99999.95 in unit mi/h: 1 decimal
Speed_Threedigits (unit m/s):
Metric:
value <= 99.95 in unit km/h: 1 decimal
value <= 999.5 in unit km/h: 0 decimals
Imperial:
value <= 99.95 in unit mi/h: 1 decimal
value <= 999.5 in unit mi/h: 0 decimals
StepLength_Threedigits (unit m): value <= 200 in unit cm: 0 decimals
Stiffness_Twodigits (unit J): value <= 80 in unit knm: 1 decimal
StrokeRate_Fivedigits (unit Hz): value <= 99999.5 in unit spm: 0 decimals
StrokeRate_Fourdigits (unit Hz): value <= 9999.5 in unit spm: 0 decimals
StrokeRate_Sixdigits (unit Hz): value <= 999999.5 in unit spm: 0 decimals
Strokes_Fivedigits: value <= 99999.5: 0 decimals
Strokes_Fourdigits: value <= 9999.5: 0 decimals
Strokes_Sixdigits: value <= 999999.5: 0 decimals
Strokes_Threedigits: value <= 999.5: 0 decimals
Sunrise_Accurate (unit s): ?h:mm'ss
Sunrise_Fivedigits (unit s): ?h:mm
Sunrise_Fourdigits (unit s): ?h:mm
Sunrise_Sixdigits (unit s): ?h:mm
Sunset_Accurate (unit s): ?h:mm'ss
Sunset_Fivedigits (unit s): ?h:mm
Sunset_Fourdigits (unit s): ?h:mm
Sunset_Sixdigits (unit s): ?h:mm
SwimDistance_Fivedigits (unit m):
Metric:
value <= 99999.5 in unit m: 0 decimals
value <= 999950 in unit km: 2 decimals
value <= 9999500 in unit km: 1 decimal
Imperial:
value <= 99999.5 in unit yd: 0 decimals
value <= 999950 in unit mi: 2 decimals
value <= 9999500 in unit mi: 1 decimal
SwimDistance_Fourdigits (unit m):
Metric:
value <= 9999.5 in unit m: 0 decimals
value <= 99995 in unit km: 2 decimals
value <= 999950 in unit km: 1 decimal
value <= 9999500 in unit km: 0 decimals
Imperial:
value <= 9999.5 in unit yd: 0 decimals
value <= 99995 in unit mi: 2 decimals
value <= 999950 in unit mi: 1 decimal
value <= 9999500 in unit mi: 0 decimals
SwimDistance_Sixdigits (unit m):
Metric:
value <= 999999.5 in unit m: 0 decimals
value <= 9999500 in unit km: 2 decimals
Imperial:
value <= 999999.5 in unit yd: 0 decimals
value <= 9999500 in unit mi: 2 decimals
SwimPace_Fivedigits (unit m/s):
Metric: value <= 59999.5 in unit s/100m: !mm'ss
Imperial: value <= 59999.5 in unit s/100yd: !mm'ss
SwimPace_FixedNoLeadingZero (unit m/s):
Metric: value <= 599999.5 in unit s/100m: !m'ss
Imperial: value <= 599999.5 in unit s/100yd: !m'ss
SwimPace_Fourdigits (unit m/s):
Metric: value <= 5999.5 in unit s/100m: !mm'ss
Imperial: value <= 5999.5 in unit s/100yd: !mm'ss
SwimPace_Sixdigits (unit m/s):
Metric: value <= 599999.5 in unit s/100m: !mm'ss
Imperial: value <= 599999.5 in unit s/100yd: !mm'ss
Swolf_Fivedigits: value <= 99999.5: 0 decimals
Swolf_Fourdigits: value <= 9999.5: 0 decimals
Swolf_Sixdigits: value <= 999999.5: 0 decimals
Swolf_Threedigits: value <= 999.5: 0 decimals
TankPressure_Nodecimal (unit Pa):
Metric: value <= 399.5 in unit bar: 0 decimals
Imperial: value <= 5801.5 in unit psi: 0 decimals
TankPressure_Sidemount (unit Pa):
Metric: value <= 399.5 in unit bar: 0 decimals
Imperial: value <= 5801.5 in unit psi: 0 decimals
Temperature_Fivedigits (unit K):
Metric: value <= 99999.5 in unit °C: 0 decimals
Imperial: value <= 99999.5 in unit °F: 0 decimals
Temperature_Fourdigits (unit K):
Metric: value <= 9999.5 in unit °C: 0 decimals
Imperial: value <= 9999.5 in unit °F: 0 decimals
Temperature_Sixdigits (unit K):
Metric: value <= 999999.5 in unit °C: 0 decimals
Imperial: value <= 999999.5 in unit °F: 0 decimals
ThreeDecimal_Fourdigits: value <= 9.999: 3 decimals
TimeOfDay_Accurate (unit s): ?h:mm'ss
TimeOfDay_Fivedigits (unit s): ?h:mm
TimeOfDay_Fourdigits (unit s): ?h:mm
TimeOfDay_Sixdigits (unit s): ?h:mm
TrainingEffect_Fivedigits: value <= 5: 1 decimal
TrainingEffect_Fourdigits: value <= 5: 1 decimal
TrainingEffect_Sixdigits: value <= 5: 1 decimal
TwoDecimal_Fourdigits: value <= 99.99: 2 decimals
Undulation_Fivedigits (unit m):
Metric: value <= 99.95 in unit cm: 1 decimal
Imperial: value <= 39.995 in unit in: 2 decimals
Undulation_Fourdigits (unit m):
Metric: value <= 99.95 in unit cm: 1 decimal
Imperial: value <= 39.995 in unit in: 2 decimals
Undulation_Threedigits (unit m):
Metric: value <= 99.95 in unit cm: 1 decimal
Imperial: value <= 9.995 in unit in: 2 decimals
VO2_Fivedigits: value <= 99.5: 1 decimal
VO2_Fourdigits: value <= 99.5: 1 decimal
VO2_Sixdigits: value <= 99.5: 1 decimal
VerticalSpeedFreedive_Fivedigits (unit m/min):
Metric:
value <= 9999.5 in unit m/s: 1 decimal
value <= 99999.5 in unit m/s: 0 decimals
Imperial:
value <= 9999.5 in unit ft/s: 1 decimal
value <= 99999.5 in unit ft/s: 0 decimals
VerticalSpeedFreedive_Fourdigits (unit m/min):
Metric:
value <= 999.5 in unit m/s: 1 decimal
value <= 9999.5 in unit m/s: 0 decimals
Imperial:
value <= 999.5 in unit ft/s: 1 decimal
value <= 9999.5 in unit ft/s: 0 decimals
VerticalSpeedFreedive_Threedigits (unit m/min):
Metric:
value <= 99.5 in unit m/s: 1 decimal
value <= 999.5 in unit m/s: 0 decimals
Imperial:
value <= 99.5 in unit ft/s: 1 decimal
value <= 999.5 in unit ft/s: 0 decimals
VerticalSpeedMountain_Fivedigits (unit m/s):
Metric: value <= 99999.5 in unit m/h: 0 decimals
Imperial: value <= 99999.5 in unit ft/hour: 0 decimals
VerticalSpeedMountain_Fourdigits (unit m/s):
Metric: value <= 99999.5 in unit m/h: 0 decimals
Imperial: value <= 99999.5 in unit ft/hour: 0 decimals
VerticalSpeedMountain_Sixdigits (unit m/s):
Metric: value <= 999999.5 in unit m/h: 0 decimals
Imperial: value <= 999999.5 in unit ft/hour: 0 decimals
VerticalSpeedMountain_Threedigits (unit m/s):
Metric: value <= 999.5 in unit m/h: 0 decimals
Imperial: value <= 999.5 in unit ft/hour: 0 decimals
VerticalSpeedScubaDive_Threedigits (unit m/min):
Metric:
value <= 99.5 in unit m/min: 1 decimal
value <= 999.5 in unit m/min: 0 decimals
Imperial:
value <= 99.5 in unit ft/min: 1 decimal
value <= 999.5 in unit ft/min: 0 decimals
VerticalSpeed_Fivedigits (unit m/s):
Metric: value <= 99999.5 in unit m/min: 0 decimals
Imperial: value <= 99999.5 in unit ft/min: 0 decimals
VerticalSpeed_Fourdigits (unit m/s):
Metric: value <= 9999.5 in unit m/min: 0 decimals
Imperial: value <= 9999.5 in unit ft/min: 0 decimals
VerticalSpeed_Sixdigits (unit m/s):
Metric: value <= 999999.5 in unit m/min: 0 decimals
Imperial: value <= 999999.5 in unit ft/min: 0 decimals
VerticalSpeed_Threedigits (unit m/s):
Metric: value <= 999.5 in unit m/min: 0 decimals
Imperial: value <= 999.5 in unit ft/min: 0 decimals
Volume_Threedigits (unit m^3):
value <= 99.95 in unit l: 1 decimal
value <= 1000 in unit l: 0 decimals
Weigth_Fivedigits (unit kg):
Metric: value <= 999.95 in unit kg: 1 decimal
Imperial: value <= 999.95 in unit lb: 1 decimal
Weigth_Fourdigits (unit kg):
Metric: value <= 999.95 in unit kg: 1 decimal
Imperial: value <= 999.95 in unit lb: 1 decimal
Weigth_Nodecimal (unit kg):
Metric: value <= 999.95 in unit kg: 0 decimals
Imperial: value <= 999.95 in unit lb: 0 decimals
Weigth_Sixdigits (unit kg):
Metric: value <= 999.95 in unit kg: 1 decimal
Imperial: value <= 999.95 in unit lb: 1 decimal
WindSpeed_Fourdigits (unit m/s):
Metric: value <= 999.5 in unit m/s: 1 decimal
Imperial: value <= 999.5 in unit mi/h: 1 decimal
WindSpeed_Threedigits (unit m/s):
Metric: value <= 999.5 in unit m/s: 0 decimals
Imperial: value <= 999.5 in unit mi/h: 0 decimals
ZoneSenseDuration_Accurate (unit s):
value <= 3600: mm'ss.f
value <= 360000: !h:mm'ss
value <= 3600000: !h:mm
ZoneSenseDuration_Approximate (unit s):
value <= 60: ss
value <= 3600: mm
value <= 360000: !hh:mm
value <= 3600000: !h
ZoneSenseDuration_Fivedigits (unit s):
value <= 60: mm'ss.f
value <= 36000: !h:mm'ss
value <= 3600000: !hh:mm
ZoneSenseDuration_Fourdigits (unit s):
value <= 60: ss.f
value <= 3600: mm'ss
value <= 360000: !hh:mm
value <= 3600000: !h
ZoneSenseDuration_Sixdigits (unit s):
value <= 60: mm'ss.f
value <= 3600000: !h:mm'ss