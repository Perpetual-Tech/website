(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scene = document.querySelector(".scene");
  const svg = document.querySelector(".cradle");
  const light = document.querySelector("#ball-tone");
  const hint = document.querySelector(".interaction-hint");
  const handles = new Map([...document.querySelectorAll(".pendulum-handle")]
    .map((element) => [Number(element.dataset.index), element]));
  const pendulums = [...document.querySelectorAll(".pendulum")].map((element, index) => ({
    x: Number(element.dataset.x),
    wire: element.querySelector(".wire"),
    bob: element.querySelector(".bob"),
    handle: handles.get(index),
    angle: 0,
  }));

  const LENGTH = 170;
  const PIVOT_Y = 100;
  const RADIUS = 18;
  const AMPLITUDE = 0.68;
  const MAX_ANGLE = 0.72;
  const PERIOD = 2800;
  const swingSamples = [AMPLITUDE];
  const step = 0.001;
  let sampleAngle = AMPLITUDE;
  let sampleVelocity = 0;
  while (sampleAngle > 0) {
    sampleVelocity -= Math.sin(sampleAngle) * step / 2;
    sampleAngle += sampleVelocity * step;
    sampleVelocity -= Math.sin(sampleAngle) * step / 2;
    swingSamples.push(Math.max(0, sampleAngle));
  }

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let strength = AMPLITUDE;
  let elapsed = 0;
  let lastTime = null;
  let frameId = null;
  let drag = null;
  let transition = null;
  const hover = { x: 0, y: 0, targetX: 0, targetY: 0 };

  function swingAt(progress) {
    const sample = clamp(progress, 0, 1) * (swingSamples.length - 1);
    const index = Math.floor(sample);
    const next = Math.min(index + 1, swingSamples.length - 1);
    return (swingSamples[index] + (swingSamples[next] - swingSamples[index]) * (sample - index))
      * strength / AMPLITUDE;
  }

  function position(index, angle) {
    const pendulum = pendulums[index];
    const x = pendulum.x + Math.sin(angle) * LENGTH;
    const y = PIVOT_Y + Math.cos(angle) * LENGTH;
    const attachmentX = x - Math.sin(angle) * RADIUS;
    const attachmentY = y - Math.cos(angle) * RADIUS;
    pendulum.angle = angle;
    pendulum.wire.setAttribute("d", "M" + pendulum.x + " " + PIVOT_Y + "L" + attachmentX + " " + attachmentY);
    pendulum.bob.setAttribute("transform", "translate(" + x + " " + y + ")");
    if (pendulum.handle) {
      pendulum.handle.style.left = (x - 160) / 480 * 100 + "%";
      pendulum.handle.style.top = (y - 60) / 310 * 100 + "%";
    }
  }

  function draw(delta = 0) {
    const angles = [0, 0, 0, 0, 0];
    if (drag && drag.active) {
      drag.rest.forEach((angle, index) => {
        drag.rest[index] = angle * Math.exp(-delta / 80);
        angles[index] = index === drag.index ? drag.angle : drag.rest[index];
      });
    } else {
      const quarter = (elapsed % PERIOD) / (PERIOD / 4);
      if (quarter < 1) angles[0] = -swingAt(quarter);
      else if (quarter < 2) angles[4] = swingAt(2 - quarter);
      else if (quarter < 3) angles[4] = swingAt(quarter - 2);
      else angles[0] = -swingAt(4 - quarter);

      const contactClock = elapsed + PERIOD / 4;
      const sinceContact = contactClock % (PERIOD / 2);
      const direction = Math.floor(contactClock / (PERIOD / 2)) % 2 ? 1 : -1;
      for (let index = 1; index <= 3; index += 1) {
        const time = sinceContact - (direction > 0 ? index - 1 : 3 - index) * 12;
        angles[index] = time > 0 && time < 180
          ? direction * Math.sin(time / 120 * Math.PI * 2) * Math.exp(-time / 34) * 0.005
          : 0;
      }
    }

    if (transition) {
      transition.time += delta;
      const progress = clamp(transition.time / 180, 0, 1);
      const blend = progress * progress * (3 - 2 * progress);
      angles.forEach((angle, index) => {
        angles[index] = transition.from[index] + (angle - transition.from[index]) * blend;
      });
      if (progress === 1) transition = null;
    }
    angles.forEach((angle, index) => position(index, angle));
  }

  function updateHover(delta) {
    const blend = 1 - Math.exp(-delta / 110);
    hover.x += (hover.targetX - hover.x) * blend;
    hover.y += (hover.targetY - hover.y) * blend;
    scene.style.setProperty("--tilt-x", -hover.y * 2 + "deg");
    scene.style.setProperty("--tilt-y", hover.x * 3 + "deg");
    light.setAttribute("cx", 32 + hover.x * 10 + "%");
    light.setAttribute("cy", 24 + hover.y * 8 + "%");
  }

  function tick(time) {
    const delta = lastTime === null ? 0 : Math.min(time - lastTime, 64);
    lastTime = time;
    if (!(drag && drag.active)) {
      elapsed += delta;
      strength += (AMPLITUDE - strength) * (1 - Math.exp(-delta / 8000));
    }
    draw(delta);
    updateHover(delta);
    frameId = requestAnimationFrame(tick);
  }

  function sync() {
    if (frameId !== null) cancelAnimationFrame(frameId);
    frameId = null;
    lastTime = null;
    if (!reducedMotion.matches && !document.hidden) frameId = requestAnimationFrame(tick);
  }

  function localPoint(event) {
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  }

  function finishDrag(event) {
    if (!drag || (event && event.pointerId !== drag.pointerId)) return;
    const released = drag;
    drag = null;
    scene.classList.remove("is-dragging");
    if (released.handle.hasPointerCapture(released.pointerId)) {
      released.handle.releasePointerCapture(released.pointerId);
    }
    if (!released.active) return; // A tap never interrupts or restarts the loop.
    if (!reducedMotion.matches) {
      transition = { from: pendulums.map((pendulum) => pendulum.angle), time: 0 };
      strength = Math.max(0.18, Math.abs(released.angle));
      let low = 0;
      let high = 1;
      // Match the release position, including very small drags, without a jump.
      for (let index = 0; index < 20; index += 1) {
        const middle = (low + high) / 2;
        if (swingAt(middle) > Math.abs(released.angle)) low = middle;
        else high = middle;
      }
      elapsed = ((released.index === 0 ? 0 : 2) + (low + high) / 2) * PERIOD / 4;
    }
    sync();
  }

  handles.forEach((handle, index) => {
    handle.hidden = false;
    handle.addEventListener("pointerdown", (event) => {
      if (drag || !event.isPrimary || event.button !== 0) return;
      const point = localPoint(event);
      if (!point) return;
      const pendulum = pendulums[index];
      drag = {
        index, handle, pointerId: event.pointerId,
        startX: event.clientX, startY: event.clientY,
        offsetX: point.x - pendulum.x - Math.sin(pendulum.angle) * LENGTH,
        active: false, angle: pendulum.angle,
      };
      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.active) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6) return;
        drag.active = true;
        drag.rest = pendulums.map((pendulum) => pendulum.angle);
        transition = null;
        scene.classList.add("is-dragging");
        scene.classList.add("has-interacted");
        hover.targetX = 0;
        hover.targetY = 0;
      }
      const point = localPoint(event);
      if (!point) return;
      const offset = (point.x - drag.offsetX - pendulums[index].x) / LENGTH;
      const angle = Math.asin(clamp(offset, -1, 1));
      drag.angle = index === 0 ? clamp(angle, -MAX_ANGLE, 0) : clamp(angle, 0, MAX_ANGLE);
      draw();
    });

    handle.addEventListener("pointerup", finishDrag);
    handle.addEventListener("pointercancel", finishDrag);
    handle.addEventListener("lostpointercapture", finishDrag);
    handle.addEventListener("click", (event) => {
      // Native button activation supports Enter, Space, and assistive tools.
      // Pointer clicks have a nonzero detail and deliberately do nothing.
      if (event.detail !== 0 || drag) return;
      scene.classList.add("has-interacted");
      if (reducedMotion.matches) {
        position(index, (index === 0 ? -1 : 1) * MAX_ANGLE);
        return;
      }
      transition = { from: pendulums.map((pendulum) => pendulum.angle), time: 0 };
      strength = MAX_ANGLE;
      elapsed = (index === 0 ? 3 : 1) * PERIOD / 4;
      sync();
    });
  });

  scene.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "mouse" || reducedMotion.matches || drag) return;
    const bounds = scene.getBoundingClientRect();
    hover.targetX = clamp((event.clientX - bounds.left) / bounds.width * 2 - 1, -1, 1);
    hover.targetY = clamp((event.clientY - bounds.top) / bounds.height * 2 - 1, -1, 1);
  });

  scene.addEventListener("pointerleave", () => {
    hover.targetX = 0;
    hover.targetY = 0;
  });

  reducedMotion.addEventListener("change", () => {
    hover.x = hover.y = hover.targetX = hover.targetY = 0;
    updateHover(0);
    sync();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      finishDrag();
      hover.x = hover.y = hover.targetX = hover.targetY = 0;
      updateHover(0);
    }
    sync();
  });

  hint.hidden = false;
  draw();
  sync();
})();
