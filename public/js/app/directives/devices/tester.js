
Lyre.directive('lyreDeviceTester', ['$interval', '$timeout', 'Socket', 'User',
    function ($interval, $timeout, Socket, User) {

    var vRef = 3.3;
    var dRes = 4095;
    var vStep = vRef / dRes;

    var directive = {
        scope: {},
        templateUrl: 'views/tester.html',
        controllerAs: 'cntrlr',
        controller: function($scope, $element, $attrs) {

            var id = $attrs.deviceId;
            var device = User.devices.child(id);
            var components = device.child('components');
            var tests = device.child('tests');

            $scope.testname = "";
            $scope.increment = 100;
            $scope.sweeping = false;
            $scope.recording = false;
            $scope.connected = false;
            $scope.tests = [{name: ''}];

            var $chart = $element.find('.chart');
            var highchart = setupChart($chart).highcharts();
            var adcseries = highchart.series[1];
            var interval;

            tests.on('child_added', function (test) {
                $scope.tests.push({name: test.key()});
            });

            components.child('network').on('value', function (data) {
                $scope.connected = (data.val().connected === 'true');
                $timeout(function(){$scope.$apply();},0);
            });

            components.child('vol').on('value', function (data) {
                $scope.level = data.val().level;
                $timeout(function(){$scope.$apply();},0);
            });

            components.child('dac1').on('value', function (data) {
                $scope.dac = data.val().value;
                $timeout(function(){$scope.$apply();},0);
            });

            components.child('adc1').on('value', function (data) {
                plotPoint(data.val().compare);
            });

            components.child('adc2').on('value', function (data) {
                plotPoint(data.val().compare);
            });

            components.child('ldr1').on('value', function (data) {
                plotPoint(data.val().compare);
            });

            components.child('ldr2').on('value', function (data) {
                plotPoint(data.val().compare);
            });

            function plotPoint(point) {

                point = point.split(":").map(Number);

                var dacVal = point[0];
                var adcVal = calcVoltage(point[1]);
                var xy = [dacVal, adcVal];

                adcseries.addPoint(xy, true, false, false);

                if ($scope.recording && $scope.testname) {
                    device.child('tests/' + $scope.testname + '/' + dacVal).set(adcVal);
                }

            }

            function load() {

                var test = $scope.loadresults;

                if (!test) { return; }

                $scope.testname = test.name;

                if (test.name) {

                    var newData = [];

                    device.child('tests/' + test.name).once('value', function (data) {

                        data.forEach(function (point) {
                            var dacVal = parseInt(point.key(), 10);
                            var adcVal = parseFloat(point.val());
                            newData.push([dacVal, adcVal]);
                        });

                        adcseries.setData(newData, true, false, true);
                        adcseries.show();

                    });

                } else {

                    // Wipe out all the current data
                    adcseries.setData([], true, false, true);
                    $scope.loadresults = "";
                }

            }

            function addseries() {

                var points = [];

                adcseries.data.forEach(function(Point){
                    points.push([Point.x, Point.y]);
                });

                highchart.addSeries({
                    name: $scope.testname,
                    data: points
                });

            }

            function reset() {
                Socket.emit("resetall");
                $scope.level = "0";
                $scope.testname = "";
                $scope.loadresults = "";
                $scope.recording = false;
                adcseries.setData([], true, false, true);
            }

            function sweep() {
                $scope.sweeping = true;

                interval = $interval(function() {
                    var newVal = parseInt($scope.dac, 10);
                    newVal += parseInt($scope.increment, 10);
                    components.child("dac1/value").set(newVal.toString());
                    if (newVal > dRes) { stop(); }
                }, 500);
            }

            function record() {
                $scope.recording = !$scope.recording;
            }

            function stop() {
                $scope.sweeping = false;
                $interval.cancel(interval);
            }

            function setval() {
                var val = parseInt($scope.dac, 10).toString();
                device.child('components/dac1/value').set(val);
            }

            function setlevel() {
                var val = parseInt($scope.level, 10).toString();
                device.child('components/vol/level').set(val);
            }

            function calibrate(which) {
                Socket.emit("calibrate" + which);
            }

            return {
                addseries: addseries,
                calibrate: calibrate,
                setlevel: setlevel,
                setval: setval,
                record: record,
                reset: reset,
                sweep: sweep,
                stop: stop,
                load: load
            }

        },
        link: function ($scope, $element, $attrs, $controller) {


        }

    };


    function setupChart($elem) {

        var linear = [];
        for (var i = 0; i < 4095; i = i + 10) {
            linear.push([i, calcVoltage(i)]);
        }

        return $elem.highcharts({
            chart: {
                zoomType: 'x',
                events: {
                    load: function () {
                        this.myTooltip = new Highcharts.Tooltip(this, this.options.tooltip);
                    }
                }
            },
            colors: ['#50B432', '#ED561B', '#DDDF00', '#24CBE5', '#64E572', '#FF9655', '#FFF263', '#6AF9C4'],
            title: {text: ''},
            xAxis: {
                title: {text: 'DAC Value'},
                allowDecimals: false,
                tickInterval: 10,
                ceiling: dRes,
                max: dRes,
                floor: 0,
                min: 0
            },
            yAxis: {
                title: {text: 'ADC Reading'},
                allowDecimals: true,
                tickInterval: .01,
                ceiling: vRef,
                max: vRef,
                floor: 0,
                min: 0
            },
            tooltip: {
                enabled: false,
                shadow: false,
                animation: false,
                valueDecimals: 4,
                followTouchMove: false,
                valueSuffix: ' Volts',
                pointFormat: '{point.x}: <b>{point.y}</b><br/>'
            },
            series: [{
                name: 'Linear',
                data: linear,
                visible: false,
                marker: {
                    states: {
                        hover: {
                            enabled: false
                        }
                    }
                }
            }, {
                name: 'ADC Reading',
                type: 'scatter',
                data: [],
                marker: {
                    states: {
                        hover: {
                            enabled: false
                        }
                    }
                },
                stickyTracking: false,
                events: {
                    click: function (evt) {
                        this.chart.myTooltip.refresh(evt.point, evt);
                    },
                    mouseOut: function () {
                        this.chart.myTooltip.hide();
                    }
                }
            }]
        });

    }


    function calcVoltage(value) {
        return vStep * value;
    }


    return directive;

}]);