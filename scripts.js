const accBar = document.querySelector("#acc .bar");
const accMinBar = document.querySelector("#acc-min .bar");
const accMaxBar = document.querySelector("#acc-max .bar");
const accNumber = document.querySelector("#acc .number");
const accMinNumber = document.querySelector("#acc-min .number");
const accMaxNumber = document.querySelector("#acc-max .number");

const rotBar = document.querySelector("#rot .bar");
const rotNumber = document.querySelector("#rot .number");

/********************************************************************
 * 
 *  start screen (overlay)
 * 
 */
const startScreenDiv = document.getElementById("start-screen");
const startScreenTextDiv = startScreenDiv.querySelector("p");

function setOverlayText(text) {
  startScreenTextDiv.classList.remove("error");
  startScreenTextDiv.innerHTML = text;
}

function setOverlayError(text) {
  startScreenTextDiv.classList.add("error");
  startScreenTextDiv.innerHTML = text;
}

// start
startScreenDiv.style.display = "block";
setOverlayText("touch screen to start");

startScreenDiv.addEventListener("click", () => {
  setOverlayText("checking for motion sensors...");

  Promise.all([requestWebAudio(), requestDeviceMotion()])
    .then(() => {
      startScreenDiv.style.display = "none";
    })
    .catch((error) => {
      setOverlayError(error);
    });
});

/********************************************************************
 * 
 *  web audio
 * 
 */
const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContext();
const sounds = ['left.mp3', 'rigth.mp3'];
const audioBuffers = [];

for (let i = 0; i < sounds.length; i++) {
  const request = new XMLHttpRequest();
  request.responseType = 'arraybuffer';
  request.open('GET', 'sounds/' + sounds[i]);
  request.addEventListener('load', () => {
    const ac = new AudioContext();
    ac.decodeAudioData(request.response, (buffer) => audioBuffers[i] = buffer);
  });

  request.send();
}

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

function playSound(index) {
  // create audio context on first button and keep it
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

function requestDeviceMotion() {
  return new Promise((resolve, reject) => {
    dataStreamResolve = resolve;

    // set timeout in case that the API response, but no data is sent
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

              // re-invert inverted iOS acceleration values
              scaleAcc = -1; // ???
            } else {
              reject("no permission for device motion");
            }
          })
          .catch(console.error);

        // DeviceOrientationEvent.requestPermission()
        //   .then((response) => {
        //     if (response == "granted") {
        //       window.addEventListener("deviceorientation", onDeviceOrientation);
        //       resolve();
        //     } else {
        //       reject("no permission for device orientation");
        //     }
        //   })
        //   .catch(console.error);
      } else {
        // no permission needed on non-iOS devices
        window.addEventListener("devicemotion", onDeviceMotion);
        // window.addEventListener("deviceorientation", onDeviceOrientation);
      }
    } else {
      reject("device motion/orientation not available");
    }
  });
}

let filterCoeff = null;
let filteredAcc = 0;

let accMin = Infinity;
let accMax = -Infinity;

function onDeviceMotion(e) {
  if (dataStreamTimeout !== null && dataStreamResolve !== null) {
    dataStreamResolve();
    clearTimeout(dataStreamTimeout);
  }

  if (filterCoeff === null) {
    filterCoeff = Math.exp(-2.0 * Math.PI * e.interval / 2);
  }

  const acc = scaleAcc * e.acceleration.x;
  filteredAcc = filterCoeff * filteredAcc + (1 - filterCoeff) * acc;

  if (filteredAcc > 2) {
    playSound(0);
  } else if (filteredAcc < -2) {
    playSound(1);
  }

  accMin = Math.min(accMin, filteredAcc);
  accMax = Math.max(accMax, filteredAcc);

  setBiBar(accBar, filteredAcc / 20);
  setNumber(accNumber, filteredAcc);
  setBiBar(accMinBar, accMin / 20);
  setNumber(accMinNumber, accMin);
  setBiBar(accMaxBar, accMax / 20);
  setNumber(accMaxNumber, accMax);

  const rot = e.rotationRate.gamma;
  setBiBar(rotBar, rot / 360);
  setNumber(rotNumber, rot);
}

function onDeviceOrientation(e) {
  if (dataStreamTimeout !== null && dataStreamResolve !== null) {
    dataStreamResolve();
    clearTimeout(dataStreamTimeout);
  }

  // e.alpha, e.beta, e.gamma
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
