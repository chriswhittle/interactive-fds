
function logspace(start, end, n) {
    start = Math.log10(start);
    end = Math.log10(end);

    arr = [];
    delta = (end - start)/(n-1);
    cur = start;
    for (var i = 0; i < n; i++) {
        arr.push(cur);
        cur += delta;
    }

    return arr.map(x => 10**x);
}

var Slider = function(min, max, def, id, rounding = 0, step = 1, log=false) {
    this.min = min;
    this.def = def;
    this.max = max;

    this.label_object = $("#" + id + " label");
    this.range_object = $("#" + id + " input[type=range]");

    this.log = log;
    this.calc_log = function(value) {
        return (this.log) ? Math.log10(value) : value;
    }

    this.range_object.attr('min', this.calc_log(min));
    this.range_object.attr('max', this.calc_log(max));
    if (log) {
        step = step * (this.calc_log(max)-this.calc_log(min)) / (max-min);
        step = step.toPrecision(1);
    }
    this.range_object.attr('step', step);
    this.range_object.val(this.calc_log(def));

    this.rounding = rounding;

    this.getValue = function() {
        value = this.range_object.val();
        return (log) ? 10**value : value;
    };

    this.updateLabel = function() {
        this.label_object.html(parseFloat(this.getValue()).toFixed(this.rounding));
    }

    this.updateLabel();

    this.range_object.on('input change', () => {this.updateLabel();} );
    this.range_object.on('input change', update_chart);
}

var power_slider = new Slider(1, 1500, 200, 'power', 0, 1, true);
var sqz_slider = new Slider(0, 15, 0, 'sqz', 1, 0.1);
var angle_slider = new Slider(0, 90, 0, 'angle', 0, 1);
var fc_length_slider = new Slider(1, 1000, 100, 'fc-length', 0, 1, true);
var fc_input_slider = new Slider(1, 5000, 100, 'fc-input', 0, 1, true);
// var fc_loss_slider = new Slider(1, 1000, 20, 'fc-loss', 0, 1, true);

var lambda_ = 1064e-9;
var k = 2*Math.PI / lambda_;

var gamma = 2*Math.PI*450;
var L = 3995;
var m = 40;
var hbar = 1.054e-34;
var c_light = 3e8;
var eta_i = 1 - 0.1;
var eta_o = 1 - 0.15;
var psi = 0;

function sqz_transformation(r, phi, K) {
    a = max_elongation**(2*r);
    ai = max_elongation**(-2*r);
    c = Math.cos(phi);
    s = Math.sin(phi);

    return [a*c**2 + ai*s**2, -K*(a*c**2 + ai*s**2)+Math.sin(2*phi) * (a - ai)/2,
	    K*(a*c**2 + ai*s**2) + Math.sin(2*phi) * (a - ai)/2, a*(-K*c+s)**2 + ai*(c+K*s)**2];
}


function compute_quantum(f, return_geometry=false) {
    return f.map(function(o, i) {
        power = power_slider.getValue()*1e3;
        sqz_db = sqz_slider.getValue();
        phi = angle_slider.getValue() * Math.PI / 180;

        Omega = 2*Math.PI*o;
        G2 = gamma*c_light/2/L / (gamma**2 + Omega**2);

        K = 32*k*G2*power/m/Omega**2/c_light;

        eta_e = 1 - ( (1-eta_i) + (1-eta_o)/(1+K**2) )

        theta_star = Math.atan(K) + psi*Omega**2 / (gamma**2 + Omega**2);
        r = sqz_db/20 * Math.log(10);

        if ($("#filter-cavity-on").is(':checked')) {
            fc_loss = 0;// fc_loss_slider.getValue()*1e-6;
            fc_input = fc_input_slider.getValue()*1e-6;
            fc_length = fc_length_slider.getValue();

            epsilon = (fc_loss > fc_input) ? 1 : 2*fc_loss / (fc_loss+fc_input);

            gamma_fc = (fc_input + fc_loss)/2 * c_light / 2 / fc_length;

            alpha = Math.atan((2-epsilon)*Math.sqrt(1-epsilon)*gamma_fc**2/Omega**2);

            phi += alpha;
        }

        if (return_geometry) {
            return [sqz_transformation(r, phi, 0),
                    sqz_transformation(r, phi, -K)]
        }

        S = Math.exp(-2*r)*Math.cos(phi-theta_star)**2 + Math.exp(2*r)*Math.sin(phi-theta_star)**2;
        S_star = eta_e * S + (1-eta_e);

        Delta_x2 = S_star * (1+eta_o*K**2) * hbar * c_light / eta_o / 8 / k / G2 / power;

        return Math.sqrt(Delta_x2)/L;
    })
}

function compute_total(quantum, classical=classical_noise) {
    return quantum.map(function(o, i) {
        return Math.sqrt(o**2 + classical[i]);
    });
}

function zip(a, b) {
    return a.map(function(o, i) {
        return {x: o, y: b[i]};
    })
}

function draw_ellipse(context, x, y, r, T) {
    scaling = Math.max.apply(null, T.map(x => Math.abs(x)));
    scaling = Math.sqrt(T[0]**2 + T[3]**2);
    r /= (1 + (scaling/25))

    context.beginPath();
    context.save();
    context.translate(x, y);
    context.transform(T[0], T[2], T[1], T[3], 0, 0)
    context.arc(0, 0, r, 0, 2*Math.PI);
    context.restore();
    context.fill();
}

function update_chart() {
    var quantum = compute_quantum(frequencies)
    chart.data.datasets[0].data = zip(frequencies, quantum);
    chart.data.datasets[1].data = zip(frequencies, compute_total(quantum))
    chart.update();
}

var frequencies = logspace(7, 1e4, 200);
var saved_data = JSON.parse(saved_data);
var classical_noise = saved_data['classical'];
var quantum = compute_quantum(frequencies);

var circle_freqs = logspace(20, 1500, 6);
var input_height = 3e-21;
var output_height = 4e-22;
var circle_radius = 15;
var label_freq = 3e3;

var readout_freq = 9e1;
var readout_height = 1.5e-22;

var input_style = 'rgba(50, 50, 155, 0.5)';
var output_style = 'rgba(50, 155, 50, 0.5)';
var readout_style = 'rgba(215, 120, 40, 0.7)';

var max_elongation = 1.4;

var originalLineDraw = Chart.controllers.line.prototype.draw;
Chart.helpers.extend(Chart.controllers.line.prototype, {
    draw: function() {
        originalLineDraw.apply(this, arguments);

        var chart = this.chart;
        var ctx = chart.chart.ctx;

        var index = chart.config.data.lineAtIndex;

        if (index && this.index == 0) {
            var xaxis = chart.scales['x-axis-0'];
            var yaxis = chart.scales['y-axis-0'];

            input_y = yaxis.getPixelForValue(input_height, index);
            output_y = yaxis.getPixelForValue(output_height, index);

            var quantum_state = compute_quantum(circle_freqs, true);
            ctx.lineWidth = 3;

            for (var i = 0; i < circle_freqs.length; i++) {
                x = xaxis.getPixelForValue(circle_freqs[i], index) + circle_radius;

                ctx.fillStyle = input_style;
                draw_ellipse(ctx, x, input_y, circle_radius, quantum_state[i][0]);

                ctx.fillStyle = output_style;
                draw_ellipse(ctx, x, output_y, circle_radius, quantum_state[i][1]);

                ctx.strokeStyle = readout_style;
                ctx.beginPath();
                ctx.moveTo(x, output_y + circle_radius*1.5);
                ctx.lineTo(x, output_y - circle_radius*1.5);
                ctx.stroke();

            }

            label_x = xaxis.getPixelForValue(label_freq, index);
            ctx.font = "18px Arial";
            ctx.fillStyle = input_style;
            ctx.fillText("Input State", label_x, input_y);
            ctx.fillStyle = output_style;
            ctx.fillText("Output State", label_x, output_y);

            ctx.fillStyle = readout_style;
            ctx.fillText("Readout Quadrature", xaxis.getPixelForValue(readout_freq, index),
            yaxis.getPixelForValue(readout_height, index));


        }
    }
});

var c = document.getElementById('plot');
var chart = new Chart(c, {
    type: 'line',
    data: {
        datasets: [{
            borderColor: 'purple',
            data: zip(frequencies, quantum),
            label: 'Quantum noise'
        },
        {
            borderColor: 'black',
            data: zip(frequencies, compute_total(quantum)),
            label: 'Total noise'
        }],
        lineAtIndex: 2
    },
    options: {
        elements: {
            line: {
                fill: false
            },
            point: {
                radius: 0
            }
        },
        responsive: false,
        scales: {
            xAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: 'Frequency [Hz]'
                },
                ticks: {
                    min: 7,
                    max: 1e4
                },
                type: 'logarithmic'
            }],
            yAxes: [{
                display: true,
                scaleLabel: {
                    display: true,
                    labelString: 'Strain [m / sq rt Hz]'
                },
                ticks: {
                    min: 4e-25,
                    max: 1e-20,
                    callback: function(value, index, values) {
                        eps = 1e-3;
                        coeff = Math.log10(value);
                        return (Math.abs(coeff - Math.round(coeff)) < eps) ? value.toPrecision(1) : '';
                    }
                },
                type: 'logarithmic'
            }]
        }
    }
});

chart.options.animation.duration = 0;

$("#filter-cavity-on").on('input change', update_chart);
