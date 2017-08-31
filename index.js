const debug = require('debug')('homebridge-windowskel');

var Service, Characteristic;
module.exports = function(homebridge) {
    debug('Called by homebridge');
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-windowskel", "WindowSkel", WindowSkeleton);
}

class WindowSkeleton {
    constructor(log, config) {
        debug('Begin constructor');
        this.log = log;
        this.name = config.name;
        
        this._currentPosition = 0;
        this._targetPosition = 0;
        this._positionState = Characteristic.PositionState.STOPPED;
        this._holdPosition = false;
        this._obstructionDetected = false;
        
        this._fakeTimeout = 0;
        
        /* Setup the Window Service */
        this.service = new Service.Window(this.name);
        this.characteristics = {
            CurrentPosition: this.service.getCharacteristic(Characteristic.CurrentPosition),
            TargetPosition: this.service.getCharacteristic(Characteristic.TargetPosition),
            PositionState: this.service.getCharacteristic(Characteristic.PositionState),
            HoldPosition: this.service.getCharacteristic(Characteristic.HoldPosition),
            ObstructionDetected: this.service.getCharacteristic(Characteristic.ObstructionDetected),
            Name: this.service.getCharacteristic(Characteristic.Name)
        }
            
        /********** REQUIRED CHARACTERISTICS **********************/
        // Characteristic.CurrentPosition Uint8 Percent Read, Notify
        this.characteristics.CurrentPosition
            .on('get', this.getCurrentPosition.bind(this));
        
        // Characteristic.TargetPosition Uint8 Percent Read, Write, Notify
        this.characteristics.TargetPosition
            .on('get', this.getTargetPosition.bind(this))
            .on('set', this.setTargetPosition.bind(this));
        
        // Characteristic.PositionState enum(DECREASING, INCREASING, STOPPED) Read, Notify
        this.characteristics.PositionState
            .on('get', this.getPositionState.bind(this));
        
        /********** OPTIONAL CHARACTERISTICS **********************/
        // Characteristic.HoldPosition Bool Write
        this.characteristics.HoldPosition
            .on('set', this.setHoldPosition.bind(this));
        
        // Characteristic.ObstructionDetected Bool Read, Notify
        this.characteristics.ObstructionDetected
            .on('get', this.getObstructionDetected.bind(this));
        
        // Characteristic.Name String Read, Notify
        this.characteristics.Name
            .on('get', this.getName.bind(this));

        /* Setup the AccessoryInformation Service */
        this.informationService = new Service.AccessoryInformation();
        this.informationService
            /********** REQUIRED CHARACTERISTICS **********************/
            // Characteristic.Identify Bool Write
            .getCharacteristic(Characteristic.Identify).on('get', this.identify.bind(this));
        this.informationService
            // Characteristic.Manufacturer String Read
            .setCharacteristic(Characteristic.Manufacturer, 'Michael Anderson')
            // Characteristic.Model String Read
            .setCharacteristic(Characteristic.Model, 'Window Skeleton')
            // Characteristic.Name String Read
            .setCharacteristic(Characteristic.Name, this.name)
            // Characteristic.Name String Read
            .setCharacteristic(Characteristic.SerialNumber, '0000-00-0000')
            /********** OPTIONAL CHARACTERISTICS **********************/
            // Characteristic.FirmwareRevision String Read
            .setCharacteristic(Characteristic.FirmwareRevision, '0.0.1')
            // Characteristic.HardwareRevision String Read
            .setCharacteristic(Characteristic.HardwareRevision, '0.0.2')
            // Characteristic.SoftwareRevision String Read
            .setCharacteristic(Characteristic.SoftwareRevision, require('./package').version);
        debug('End constructor');
    }
    
    /**
     * _fakeWindowOperation fakes the movement of a window. It does
     * not fake the currentPosition changing over time, but it does
     * fake a window going from open to closed. This is meant to 
     * illustrate how a window operator will send events to Homebridge
     */
    _fakeWindowOperation() {
        debug('In fakeWindowOperation');
        if (this._targetPosition > this._currentPosition) {
            this._positionState = Characteristic.PositionState.INCREASING;
            this._notifyPositionState();
        } else {
            this._positionState = Characteristic.PositionState.DECREASING;
            this._notifyPositionState();
        }
        
        if (this._fakeTimeout > 0) {
            clearTimeout(this._fakeTimeout);
        }
        
        debug('Starting fake window operation to fake a %s', this._positionState === Characteristic.PositionState.INCREASING ? 'OPEN' : 'CLOSE');
        this._fakeTimeout = setTimeout((function() {
            this._fakeTimeout = 0;
            this._currentPosition = this._targetPosition;
            this._positionState = Characteristic.PositionState.STOPPED;

            this._notifyPositionState();
            this._notifyCurrentPosition();
        }).bind(this), 2000);
    }
    
    /**************************************************************************
        Private Methods
    ***************************************************************************/
    
    /**
     * _notifyCurrentPosition should be called when the current position is
     * changed. If the current position can be sensed, report that position,
     * otherwise use this to notify 100% for fully open or 0% for full closed.
     */
    _notifyCurrentPosition() {
        debug('_notifyCurrentPosition: %o', this._currentPosition);
        this.log("_notifyCurrentPosition");
        this.characteristics.CurrentPosition.setValue(this._currentPosition);
    }
    
    /**
     * _notifyTargetPosition should be only be called if the target position
     * is changed by an external source. If it is called within this script
     * the result will be an endless loop.
     */
    _notifyTargetPosition() {
        debug('_notifyTargetPosition: %o', this._targetPosition);
        this.log("_notifyTargetPosition");
        this.characteristics.TargetPosition.setValue(this._targetPosition);
    }
    
    /**
     * _notifyPositionState should be called when the state changes. This
     * is used to indicate if the window is STOPPED, INCREASING (opening)
     * or DECREASING (closing). This should be called once per state change.
     */
    _notifyTargetPosition() {
        debug('_notifyTargetPosition: %o', this._positionState);
        this.log("_notifyPositionState");
        this.characteristics.PositionState.setValue(this._positionState);
    }
    
    /**
     * _notifyObstructionDetected should be called when an obstruction is 
     * detected. If the window motor unit has built in obstruction detecting
     * without a trigger back to the controller, an obstruction could be
     * assumed if the motor is stopped prior to being fully opened or closed.
     */
    _notifyObstructionDetected() {
        debug('_notifyObstructionDetected: %o', this._obstructionDetected);
        this.log("_notifyObstructionDetected");
        this.characteristics.ObstructionDetected.setValue(this._obstructionDetected);
    }
    
    /**
     * _notifyName should be called if the window name changes.
     */
    _notifyName() {
        debug('_notifyName: %o', this.name);
        this.log("_notifyName");
        this.characteristics.Name.setValue(this.name);
    }
    
    /**************************************************************************
        Public Methods
    ***************************************************************************/
    
    /**
     * identify can be called by Homebridge to request this
     * device to identify itself. This is used when multiple
     * devices of the same type are installed/connected.
     */
    identify(callback) {
        debug('Identify called');
        this.log("identify");
        callback();
    }
    
    /**
     * getCurrentPosition is called by Homebridge to request the
     * current detected window position. Generally no action
     * is required here, but since we use a callback this can
     * take time.
     */
    getCurrentPosition(callback) {
        debug('getCurrentPosition called: %o', this._currentPosition);
        this.log("getCurrentPosition", this._currentPosition);
        callback(null, this._currentPosition);
    }
    
    /**
     * getTargetPosition is called by Homebridge at startup
     * in order to determine the current state of the window.
     * It doesn't appear to be called any other time.
     */
    getTargetPosition(callback) {
        debug('getTargetPosition called: %o', this._targetPosition);
        this.log("getTargetPosition", this._targetPosition);
        
        callback(null, this._targetPosition);
    }
    
    /**
     * setTargetPosition is called by Homebridge to set the
     * desired position of the window. Be aware that the
     * user interface can present the control as a slider
     * and therefore this will be called multiple times
     * as the user slides the control between open and 
     * close.
     */
    setTargetPosition(value, callback) {
        debug('setTargetPosition called: %o to %o', this._targetPosition, value);
        this._targetPosition = value;
        this.log("setTargetPosition", this._targetPosition);
        
        this._fakeWindowOperation();
        
        callback(null, this._targetPosition);
    }
    
    /**
     * getPositionState is called by Homebridge to request the
     * current position state (DECREASING, INCREASING or STOPPED).
     */
    getPositionState(callback) {
        debug('getPositionState called: %o', this._positionState);
        this.log("getPositionState", this._positionState);
        callback(null, this._positionState);
    }
    
    /**
     * setHoldPosition is called by Homebridge to stop or
     * restart the window while it is moving. This characteristic
     * is optional.
     */
    setHoldPosition(value, callback) {
        debug('setHoldPosition called: %o to %o', this._holdPosition, value);
        this._holdPosition = value;
        this.log("setHoldPosition", this._holdPosition);
        callback(null, this._holdPosition);
    }
    
    /**
     * getObstructionDetected is called by Homebridge to request
     * the obstruction detected state. This characteristic is 
     * optional.
     */
    getObstructionDetected(callback) {
        debug('getObstructionDetected called: %o', this._obstructionDetected);
        this.log("getObstructionDetected", this._obstructionDetected);
        callback(null, this._obstructionDetected);
    }
    
    /**
     * getName is called by Homebridge to request the name of this
     * device. This characteristic is optional.
     */
    getName(callback) {
        debug('getName called: %o', this.name);
        this.log("getName", this.name);
        callback(null, this.name);
    }

    /**
     * getServices returns an array of services that this accessory
     * implements. An accessory can implement multiple services.
     * This one implements both the Window and AccessoryInformation
     * services.
     */
    getServices() {
        debug('getServices called');
        return [this.service, this.informationService];
    }
}