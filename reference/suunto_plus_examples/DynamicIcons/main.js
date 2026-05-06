function evaluate(_input, output) {
  output.value1 = output.value1 == 5 ? -5 : output.value1 + 1;
  output.value2 = output.value2 == 5 ? -5 : output.value2 + 1;
  output.value3 = output.value3 == 5 ? -5 : output.value3 + 1;
}

function onLoad(_input, output) {
  output.value1 = -5;
  output.value2 = 0;
  output.value3 = 5;
}

function getUserInterface() {
  return {
    template: 't'
  };
}
