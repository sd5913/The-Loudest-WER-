// AudioContext times are in seconds. The timer only keeps this short queue filled.
class PetTransport {
  static startLead = .035;
  static minimumLead = .005;
  static lookAhead = .120;

  constructor(now, secondsPerBeat, steps, looping) {
    this.clocks = [{ from: now, origin: now + PetTransport.startLead, secondsPerBeat }];
    this.steps = steps;
    this.looping = looping;
    this.nextStep = 0;
    this.queue = [];
  }

  clockAt(time) {
    for (let i = this.clocks.length - 1; i > 0; i--) {
      if (this.clocks[i].from <= time) return this.clocks[i];
    }
    return this.clocks[0];
  }

  firstStepAt(time, clock) {
    return Math.max(0, Math.ceil((time - clock.origin) / clock.secondsPerBeat - 1e-9));
  }

  position(now) {
    const clock = this.clockAt(now);
    const phase = (now - clock.origin) / clock.secondsPerBeat;
    const index = Math.floor(phase + 1e-9);
    return {
      index,
      step: index < 0 ? -1 : index % this.steps,
      elapsed: phase < 0 ? 0 : (phase % this.steps) * clock.secondsPerBeat,
      finished: !this.looping && index >= this.steps
    };
  }

  update(now, secondsPerBeat, steps, looping) {
    const cutoff = now + PetTransport.minimumLead;
    const clock = this.clockAt(cutoff);
    const firstStep = this.firstStepAt(cutoff, clock);

    // Leave the audio render quantum around a due beat alone. Carry its musical
    // phase into the new tempo so an edit cannot replay or jump over a step.
    if (secondsPerBeat !== clock.secondsPerBeat) {
      const phase = Math.max(0, (cutoff - clock.origin) / clock.secondsPerBeat);
      const origin = phase > 0 ? cutoff - phase * secondsPerBeat : clock.origin;
      this.clocks = this.clocks.filter(item => item.from < cutoff);
      this.clocks.push({ from: cutoff, origin, secondsPerBeat });
    }

    this.queue = this.queue.filter(event => {
      if (event.index < firstStep && (looping || event.index < steps || event.time <= now)) return true;
      event.cancel();
      return false;
    });
    this.nextStep = Math.min(this.nextStep, firstStep);
    this.steps = steps;
    this.looping = looping;
  }

  fill(now, enqueue) {
    const currentClock = this.clockAt(now);
    this.clocks.splice(0, this.clocks.indexOf(currentClock));
    const { index } = this.position(now);
    // A throttled timer or a hidden tab can miss beats. Never enqueue past
    // audio or keep a backlog of old visual hits waiting for a frame.
    while (this.queue[0]?.index < index) this.queue.shift();
    const cutoff = now + PetTransport.minimumLead;
    const clock = this.clockAt(cutoff);
    this.nextStep = Math.max(this.nextStep, this.firstStepAt(cutoff, clock));
    while (this.looping || this.nextStep < this.steps) {
      const index = this.nextStep;
      const time = clock.origin + index * clock.secondsPerBeat;
      if (time > now + PetTransport.lookAhead) break;
      const event = enqueue(index % this.steps, Math.floor(index / this.steps), time);
      this.queue.push({ index, time, ...event });
      this.nextStep++;
    }
  }

  read(now) {
    const position = this.position(now);
    let hits = [];
    while (this.queue[0]?.time <= now) {
      const event = this.queue.shift();
      if (event.index === position.index) hits = event.hits;
    }
    return { ...position, hits };
  }

  cancel() {
    for (const event of this.queue) event.cancel();
    this.queue.length = 0;
  }
}
