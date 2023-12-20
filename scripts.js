// display elements
const accBar = document.querySelector("#acc .bar");
const accMinBar = document.querySelector("#acc-min .bar");
const accMaxBar = document.querySelector("#acc-max .bar");
const accNumber = document.querySelector("#acc .number");
const accMinNumber = document.querySelector("#acc-min .number");
const accMaxNumber = document.querySelector("#acc-max .number");

/********************************************************************
 * 
 *  start screen (overlay)
 * 
 */
const startScreenDiv = document.getElementById("start-screen");
const startScreenTextDiv = startScreenDiv.querySelector("p");

// open start screen
startScreenDiv.style.display = "block";
setOverlayText("touch screen to start");

// start after touch
startScreenDiv.addEventListener("click", () => {
  setOverlayText("checking for motion sensors...");

  const audioPromise = requestWebAudio();
  const deviceMotionPromise = requestDeviceMotion();

  Promise.all([audioPromise, deviceMotionPromise])
    .then(() => startScreenDiv.style.display = "none") // close start screen (everything is ok)
    .catch((error) => setOverlayError(error)); // display error
});

// display text on start screen
function setOverlayText(text) {
  startScreenTextDiv.classList.remove("error");
  startScreenTextDiv.innerHTML = text;
}

// display error message on start screen
function setOverlayError(text) {
  startScreenTextDiv.classList.add("error");
  startScreenTextDiv.innerHTML = text;
}

/********************************************************************
 * 
 *  web audio
 * 
 */
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
const soundFiles = ['left.mp3', 'right.mp3'];
const audioBuffers = [];

// load soundfiles into audio buffers
for (let i = 0; i < soundFiles.length; i++) {
  const request = new XMLHttpRequest();
  request.responseType = 'arraybuffer';
  request.open('GET', 'sounds/' + soundFiles[i]);
  request.addEventListener('load', () => {
    const ac = new AudioContext();
    ac.decodeAudioData(request.response, (buffer) => audioBuffers[i] = buffer);
  });

  request.send();
}

// get promise for web audio check and start
function requestWebAudio() {
  return new Promise((resolve, reject) => {
    if (AudioContext) {
      audioContext.resume()
        .then(() => resolve())
        .catch(() => reject());
    }
    else {
      reject("web audio not available");
    }
  });
}

// play sound by audio buffer index
function playSound(index) {
  const source = audioContext.createBufferSource();
  source.connect(audioContext.destination);
  source.buffer = audioBuffers[index];
  source.start(audioContext.currentTime);
}

/********************************************************************
 * 
 *  device motion/orientation
 * 
 */
let dataStreamTimeout = null;
let dataStreamResolve = null;
let scaleAcc = 1; // scale factor to re-invert iOS acceleration

// get promise for device motion check and start
function requestDeviceMotion() {
  return new Promise((resolve, reject) => {
    dataStreamResolve = resolve;

    // set timeout in case that the API is ok, but no data is sent
    dataStreamTimeout = setTimeout(() => {
      dataStreamTimeout = null;
      reject("no device motion/orientation data streams");
    }, 1000);

    if (DeviceMotionEvent || DeviceOrientationEvent) {
      if (DeviceMotionEvent.requestPermission || DeviceOrientationEvent.requestPermission) {
        // ask device motion/orientation permission on iOS
        DeviceMotionEvent.requestPermission()
          .then((response) => {
            if (response == "granted") {
              // got permission
              window.addEventListener("devicemotion", onDeviceMotion);
              resolve();
              scaleAcc = -1; // re-invert inverted iOS acceleration values
            } else {
              reject("no permission for device motion");
            }
          })
          .catch(console.error);
      } else {
        // no permission needed on non-iOS devices
        window.addEventListener("devicemotion", onDeviceMotion);
      }
    } else {
      reject("device motion/orientation not available");
    }
  });
}

const defaultThreshold = 1.5;
let filterCoeff = null;
let lastFilteredAcc = 0;
let lastDiffAcc = null;
let leftPeak = 0;
let rightPeak = 0;

function onDeviceMotion(e) {
  if (dataStreamTimeout !== null && dataStreamResolve !== null) {
    dataStreamResolve();
    clearTimeout(dataStreamTimeout);
  }

  const acc = scaleAcc * e.acceleration.x;
  const currentFilteredAcc = filterCoeff * lastFilteredAcc + (1 - filterCoeff) * acc;
  const currentDiffAcc = currentFilteredAcc - lastFilteredAcc;

  // init filterCoeff with sensor interval
  if (filterCoeff === null) {
    filterCoeff = Math.exp(-2.0 * Math.PI * e.interval / 2);
  }

  // init lastDiffAcc
  if (lastDiffAcc === null) {
    lastDiffAcc = currentDiffAcc;
  }

  if (currentFilteredAcc < -defaultThreshold && lastDiffAcc < 0 && currentDiffAcc >= 0) {
    // register left kick (negative acc minimum)
    leftPeak = currentFilteredAcc;

    // trigger on left kick but not on right stop
    const threshold = Math.min(-defaultThreshold, -0.666 * rightPeak);
    if (currentFilteredAcc < threshold) {
      playSound(0);
    }
  } else if (currentFilteredAcc >= defaultThreshold && lastDiffAcc >= 0 && currentDiffAcc < 0) {
    // register right kick (positive acc maximum)
    rightPeak = currentFilteredAcc;

    // trigger on right kick but not on left stop
    const threshold = Math.max(defaultThreshold, -0.666 * leftPeak);
    if (currentFilteredAcc >= threshold) {
      playSound(1);
    }
  }

  // display current acceleration and left/right peaks
  setBiBar(accBar, currentFilteredAcc / 20);
  setNumber(accNumber, currentFilteredAcc);
  setBiBar(accMinBar, leftPeak / 20);
  setNumber(accMinNumber, leftPeak);
  setBiBar(accMaxBar, rightPeak / 20);
  setNumber(accMaxNumber, rightPeak);

  // store current filtered acc and diff
  lastFilteredAcc = currentFilteredAcc;
  lastDiffAcc = currentDiffAcc;
}

/********************************************************
 *
 *  display functions
 *
 */
function setBar(bar, value) {
  if (value >= 0) {
    bar.style.left = "0";
    bar.style.width = `${100 * value}%`;
  }
}

function setNumber(div, value, numDec = 2) {
  div.innerHTML = value.toFixed(numDec);
}

function setBiBar(div, value) {
  if (value >= 0) {
    div.style.left = "50%";
    div.style.width = `${50 * value}%`;
  }
  else {
    div.style.left = `${50 * (1 + value)}%`;
    div.style.width = `${50 * -value}%`;
  }
}
