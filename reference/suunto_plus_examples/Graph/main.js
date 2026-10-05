var angle = 0;

function evaluate(_input, output) {
  output.sin = Math.sin(angle);
  angle += 0.5;
}

function onLoad(_input, output) {
  output.sin = 0;
}

function getUserInterface() {
  return {
    template: 'g1'
  };
}
