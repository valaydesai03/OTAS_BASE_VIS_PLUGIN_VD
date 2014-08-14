if (!jQuery) { throw new Error("OTAS Base Visualisation requires jQuery") }

+function ($) {
    "use strict";
    // MATH FUNCTIONS
    // ===============

    Math.stats = {
        distributions: {
            normal: { }
        }
    }

    Math.stats.distributions.normal = function () {
        var ns = new Object();
        var cdf = ns.cdf = function (x, mean, variance) {
            if (!mean)
                mean = 0.0;
            if (!variance)
                variance = 1.0;
            return 0.5 * (1 + erf((x - mean) / (Math.sqrt(2 * variance))));
        }

        var erf = ns.erf = function (x) {
            // save the sign of x
            var sign = (x >= 0) ? 1 : -1;
            x = Math.abs(x);

            // constants
            var a1 = 0.254829592;
            var a2 = -0.284496736;
            var a3 = 1.421413741;
            var a4 = -1.453152027;
            var a5 = 1.061405429;
            var p = 0.3275911;

            // A&S formula 7.1.26
            var t = 1.0 / (1.0 + p * x);
            var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
            return sign * y; // erf(-x) = -erf(x);
        }
        return ns;
    }();

    // DATA API CLASS DEFINITION
    // =====================
    var Data = function () { };

    var percmult = 1.0;            // TODO - CHANGE WHEN DATA IS FIXED

    var apiCall = function (url, params, callback) {
        //console.log(':::URL:::', url);
        //console.log(':::params:::', params);
        //console.log(':::callback:::', callback);

        if (!Data.apiKey)
            throw new Error("Must set apiKey property to your api key")

        var deferred = $.Deferred();

        if (params === 'stamp') {

            $.ajax({
                url: url,
                type: 'get',
                data: '',
                dataType: 'xml',
                success: function (data) {                    
                    deferred.resolve(data);
                },
                error: function () {
                    //console.log(':::error in stamp:::');
                },
                beforeSend: function (xhr) {
                    xhr.setRequestHeader('apikey', Data.apiKey)
                }
            });

        } else {
            $.ajax({
                url: url,
                type: 'get',
                data: params,
                dataType: 'json',
                success: function (data) {
                    //console.log('data:::', data);
                    deferred.resolve(data);
                },
                error: function () {
                    //console.log(':::error in other:::');
                },
                beforeSend: function (xhr) {
                    xhr.setRequestHeader('apikey', Data.apiKey)
                }
            });
        }

        //$.getJSON(url, params, function (data) {
        //    deferred.resolve(data);
        //});
        if (callback)
            deferred.done(callback);
        else
            return deferred.promise();
    };
    
    Data.api = {
        // VERSION 1
        v1: {
            stock: function (stock) {
                var toReturn = function (callback) {
                    return apiCall(otasBase.baseUrl + "/v1/stock/" + stock + "/", null, callback);
                }

                toReturn.dailyFlags = function (params, callback) {
                    return apiCall(otasBase.baseUrl + "/v1/stock/" + stock + "/dailyFlags", params, callback);
                }

                // GET DAILY SERIES
                toReturn.dailySeries = function (type, params, callback) {                    
                    return apiCall(otasBase.baseUrl + "/v1/stock/" + stock + "/series/" + type + "/", params, callback);
                }

                // GET PEERS
                toReturn.stockPeers = function (callback) {
                    return apiCall(otasBase.baseUrl + "/v1/stock/" + stock + "/peers", null, callback);
                }

                // GET STAMPS
                toReturn.stockStamps = function (params, callback) {
                    var header = params['isHeader'];                    
                    if (header === true || header === 'true') {                        
                        return apiCall(otasBase.stampUrl + "/" + params['topic'] + "/" + params['stock'] + "/1/1", 'stamp', callback);
                    } else {
                        return apiCall(otasBase.stampUrl + "/" + params['topic'] + "/" + params['stock'], 'stamp', callback);
                    }
                }

                return toReturn;
            },
            stocks: function (watchlisttype,watchlist) {
                var toReturn = function (callback) {
                    return apiCall(otasBase.baseUrl + "/v1/stocks/" + watchlisttype + "/" + watchlist + "/", null, callback);
                };

                toReturn.dailyFlags = function (params, callback) {
                    return apiCall(otasBase.baseUrl + "/v1/stocks/" + watchlisttype + "/" + watchlist + "/dailyFlags", params, callback);
                };
                return toReturn;
            },
            lists: function (params) {                
                var toReturn = function (callback) {                    
                    return apiCall(otasBase.baseUrl + "/v1/lists", params, callback);
                };                
                return toReturn;
            }
        }
    };

    Data.utils = {
        zipStocksAndFlags: function (stocks, flags) {
            var flagdict = new Object();
            for (var i = 0; i < flags.length; i++) {
                for (var f in flags[i]) {
                    flagdict[flags[i][f].otasSecurityId] = flags[i];
                    break;
                }
            }
            for (var i = 0; i < stocks.length; i++) {
                stocks[i].flags = flagdict[stocks[i].otasSecurityId];
            }
        },
        sorting: {
            sortStocksByName: function (options) {
                return function (a, b) {
                    if (a.stock.name > b.stock.name) return 1.0;
                    return -1.0;
                }
            },
            sortStocksByFlags: function (options) {
                return function (a, b) {

                    options = $.extend({}, { direction: false }, options);

                    var getLogP = function (row) {
                        var flags = row.cells.signals.data("otas.dailyFlagRow").dailyFlags;

                        var totalPos = 0.0;
                        var totalNeu = 0.0;
                        var totalNeg = 0.0;
                        for (var i = 0; i < flags.length; i++) {
                            if (flags[i].pvalue) {
                                if (flags[i].direction == Enums.buySell.BUY)
                                    totalPos += Math.log(flags[i].pvalue);
                                else if (flags[i].direction == Enums.buySell.SELL)
                                    totalNeg += Math.log(flags[i].pvalue);
                                else
                                    totalNeu += Math.log(flags[i].pvalue);
                            } else {
                                totalNeu += Math.log(0.5);
                            }
                        }
                        
                        if (options.direction) {
                            if (totalPos > totalNeg)
                                return (totalPos - totalNeg)// + totalNeu;
                            else
                                return (totalPos - totalNeg)// - totalNeu;
                        }
                        else {
                            return totalPos + totalNeg + totalNeu;
                        }
                    }

                    if (getLogP(a) > getLogP(b)) return 1.0;
                    return -1.0;
                };
            }
        }
    };



    // DISPLAY UTILS CLASS DEFINITION
    // ==============================
    var DisplayUtils = function () { };

    DisplayUtils.percentile = function (value, sig) {
        if (!sig)
            sig = 2;
        value = (value * percmult * 100.0).toPrecision(sig);
        var txt = "th";
        if (value % 10 == 1)
            txt = "st";
        if (value % 10 == 2)
            txt = "nd";
        if (value % 10 == 3)
            txt = "rd";
        return value + txt;
    }

    DisplayUtils.floatShort = function (value, sig) {
        if (!sig)
            sig = 3;
        if (value > 1e9) {
            // billions
            return (value / 1e9).toPrecision(sig) + " B";
        } else if (value > 1e6) {
            // millions
            return (value / 1e6).toPrecision(sig) + " M";
        } else if (value > 1e3) {
            // thousands
            return (value / 1e3).toPrecision(sig) + " k";
        }
        return value.toPrecision(sig);
    }

    DisplayUtils.percentage = function (value) {
        return (value * percmult * 100.0) + "%";
    };

    DisplayUtils.intradayFlagHeader = function (flagType) {
        switch (flagType) {
            case Enums.intradayFlagType.RETURN:
                return "Return";
            case Enums.intradayFlagType.VOLUME:
                return "Volume";
            case Enums.intradayFlagType.SPREAD:
                return "Spread";
            case Enums.intradayFlagType.LIQUIDITY:
                return "Liquidity";
        }
    }

    DisplayUtils.highlightBoxHeader = function (hboxType) {
        switch (hboxType) {
            case Enums.highlightBoxType.PERFORMANCE:
                return "Performance";
            case Enums.highlightBoxType.PRICEACTION:
                return "Signals";
            case Enums.highlightBoxType.EARNINGSESTIMATE:
                return "EPS Momentum";
            case Enums.highlightBoxType.EVENT:
                return "Events";
            case Enums.highlightBoxType.VOLUME:
                return "Volume";
            case Enums.highlightBoxType.VALUATION:
                return "Valuation";
            case Enums.highlightBoxType.VOLATILITY:
                return "Implied Vol";
            case Enums.highlightBoxType.CDS:
                return "CDS";
            case Enums.highlightBoxType.SHORTINTEREST:
                return "Short Interest";
            case Enums.highlightBoxType.DIVERGENCE:
                return "Divergence";
            case Enums.highlightBoxType.DIVIDEND:
                return "Dividend";
            case Enums.highlightBoxType.DIRECTORDEALING:
                return "Dir. Dealings";
        }
    }

    DisplayUtils.dailyflagheader = function (flagType) {
        switch (flagType) {
            case Enums.dailyFlagType.PRICEACTION:
                return "Signals";
            case Enums.dailyFlagType.EARNINGSESTIMATE1M:
                return "EPS Mmt.";
            case Enums.dailyFlagType.EARNINGSESTIMATE3M:
                return "EPS Mmt.";
            case Enums.dailyFlagType.VALUATION:
                return "Valuation";
            case Enums.dailyFlagType.VOLUME:
                return "Volume";
            case Enums.dailyFlagType.VOLATILILTY:
                return "Implied Vol";
            case Enums.dailyFlagType.SHORTINTEREST:
                return "Short Int.";
            case Enums.dailyFlagType.CDS:
                return "CDS";
            case Enums.dailyFlagType.DIVERGENCECDS:
                return "Diverg. CDS";
            case Enums.dailyFlagType.DIVERGENCEEPS:
                return "Diverg. EPS";
            case Enums.dailyFlagType.DIVERGENCESI:
                return "Diverg. SI";
            case Enums.dailyFlagType.DIVERGENCESKEW:
                return "Diverg. Skew";
            case Enums.dailyFlagType.EVENT:
                return "Events";
            case Enums.dailyFlagType.DIRECTORDEALING:
                return "Dir. Deals";
        }
    }

    // TECHNICALS CLASS DEFINITION
    // ===========================
    var Technicals = function () { };

    Technicals.getDisplayName = function (signalType, signalDirection) {
        var name;
        switch (signalType) {
            case Enums.technicalSignalType.BOLLINGERBAND:
                name = "Bollinger Band";
                break;
            case Enums.technicalSignalType.RSI:
                name = "RSI";
                break;
            case Enums.technicalSignalType.MACD:
                name = "MACD";
                break;
            case Enums.technicalSignalType.FASTSTOCHASTIC:
                name = "Fast Stochastic";
                break;
            case Enums.technicalSignalType.SLOWSTOCHASTIC:
                name = "Slow Stochastic";
                break;
            case Enums.technicalSignalType.FULLSTOCHASTIC:
                name = "Full Stochastic";
                break;
        }
        if (signalDirection == Enums.buySell.BUY)
            name += " (+)";
        else
            name += " (-)";
        return name;
    };

    // ENUMERATIONS
    // =============
    var Enums = function () { };

    Enums.upDown = {
        UP: "up",
        DOWN: "down"
    }

    Enums.buySell = {
        BUY: "buy",
        SELL: "sell"
    };

    Enums.technicalSignalType = {
        BOLLINGERBAND: "bollingerBand",
        RSI: "rsi",
        MACD: "macd",
        FASTSTOCHASTIC: "fastStochastic",
        SLOWSTOCHASTIC: "slowStochastic",
        FULLSTOCHASTIC: "fullStochastic"
    };

    Enums.intradayFlagType = {
        RETURN: "intradayReturn",
        VOLUME: "intradayVolume",
        LIQUIDITY: "intradayLiquidity",
        SPREAD: "intradaySpread"
    }

    Enums.dailyFlagType = {
        PRICEACTION: "priceAction",
        EARNINGSESTIMATE1M: "earningsEstimate1m",
        EARNINGSESTIMATE3M: "earningsEstimate3m",
        VALUATION: "valuation",
        VOLUME: "volume",
        VOLATILILTY: "volatility",
        SHORTINTEREST: "shortInterest",
        CDS: "cds",
        DIVERGENCEEPS: "divergenceEps",
        DIVERGENCESKEW: "divergenceSkew",
        DIVERGENCECDS: "divergenceCds",
        DIVERGENCESI: "divergenceSi",
        DIVIDEND: "dividend",
        EVENT: "event",
        DIRECTORDEALING: "directorDealing",
        RETURNVSSECTOR1D: "returnVsSector1d"
    };

    Enums.highlightBoxType = {
        PERFORMANCE: "performance",
        PRICEACTION: "priceAction",
        VOLUME: "volume",
        EARNINGSESTIMATE: "earningsEstimate",
        DIRECTORDEALING: "directorDealing",
        VALUATION: "valuation",
        VOLATILITY: "volatility",
        SHORTINTEREST: "shortInterest",
        CDS: "cds",
        DIVERGENCE: "divergence",
        EVENT: "event",
        DIVIDEND: "dividend"
    };

    Enums.otasListType = {
        WACTHCLIST: "WatchList",
        ORDERLIST: "OrderList"      
    };

    Enums.seriesType = {
        RETURN: "Return",
        RETURNVSSECTOR: "ReturnVsSector",
        RETURNVSMARKET: "ReturnVsMarket"
    };

    Enums.stampType = {
        PERFORMANCE: "Perf",
        PRICEACTION: "PriceAction",
        VOLUME: "Volume",
        EARNINGSESTIMATE: "EpsMomentum1M",
        DIRECTORDEALING: "DirectorDealing",
        VALUATION: "Valuation_3_12_3",
        VOLATILITY: "Volatility_3_15_3",
        SHORTINTERESTDATAEXPLORER: "Short",
        SHORTINTERESTSUNGUARD: "Short_Sun",
        CDS: "CDS",
        DIVERGENCEDATAEXPLORER: "Divergence",
        DIVERGENCESUNGUARD: "Divergence_3_12_2",
        EVENT: "Events",
        DIVIDEND: "dividendanalysis"
    };

    // HIGHLIGHT BOX CLASS DEFINITION
    // ==============================
    var HighlightBox = function (element, options) {
        this.$element = $(element);
        this.svgContent = options.svgContent;
        this.options = $.extend({}, HighlightBox.DEFAULTS, options);
    }

    HighlightBox.prototype._createContainer = function (boxElem) {
        var container = $(document.createElement("div"));
        var header = $(document.createElement("div"));
        container.addClass("highlightbox-container");
        header.addClass("highlightbox-header");
        container.append(header);
        container.append(boxElem);
        header.text(DisplayUtils.highlightBoxHeader(this.options.type));
        return container;
    }

    HighlightBox.prototype.init = function () {
        var elem;
        if (this.options.header) {
            elem = this._createContainer(this.svgContent);
        }
        else {
            elem = this.svgContent;
        }
        this.$element.append(elem);
    }

    // HIGHLIGHT BOX PLUGIN DEFINITION
    // ===============================
    var old = $.fn.highlightBox;

    $.fn.highlightBox = function (option) {

        return this.each(function () {
            var $this = $(this);

            var data = $this.data('otas.highlightBox');

            if (!data) $this.data('otas.highlightBox', (data = new HighlightBox(this, option)))
            data.init();
        })
    }

    // HIGHLIGHT BOX NO CONFLICT
    // =========================

    $.fn.highlightBox.noConflict = function () {
        $.fn.highlightBox = old;
        return this;
    }

    // HIGHLIGHT BOX ROW CLASS DEFINITION
    // ==================================
    var HighlightBoxRow = function (element, options) {
        this.$element = $(element);
        this.options = $.extend({}, HighlightBoxRow.DEFAULTS, options);
    }

    HighlightBoxRow.prototype.init = function () {
        var container = $(document.createElement("div")).addClass("highlightbox-row");
        for (var key in this.options.highlightBoxes) {
            var div = $(document.createElement("div")).addClass("highlightbox-row-wrapper");
            $(div).highlightBox({ svgContent: this.options.highlightBoxes[key], type: key, header: this.options.header });
            container.append(div);
        }
        this.$element.append(container);
    }

    // HIGHLIGHT BOX ROW PLUGIN DEFINITION
    // ===============================
    var old = $.fn.highlightBoxRow;

    $.fn.highlightBoxRow = function (option) {

        return this.each(function () {
            var $this = $(this);

            var data = $this.data('otas.highlightBoxRow');

            if (!data) $this.data('otas.highlightBoxRow', (data = new HighlightBoxRow(this, option)))
            data.init();
        })
    }

    // FLAG CLASS DEFINITION
    // =====================
    var Flag = function () {
    }

    // large positive up arrow
    Flag.prototype._createLrgUpPos = function () {
        return this._createIcon("icon-up-dir-1", "lrg", "pos");
    }

    // small positive up arrow
    Flag.prototype._createSmlUpPos = function () {
        return this._createIcon("icon-up-dir-1", "sml", "pos");
    }

    // large negative down arrow
    Flag.prototype._createLrgDownNeg = function () {
        return this._createIcon("icon-down-dir-1", "lrg", "neg");
    }

    // small negative down arrow
    Flag.prototype._createSmlDownNeg = function () {
        return this._createIcon("icon-down-dir-1", "sml", "neg");
    }

    // large negative up arrow
    Flag.prototype._createLrgUpNeg = function () {
        return this._createIcon("icon-up-dir-1", "lrg", "neg");
    }

    // small negative up arrow
    Flag.prototype._createSmlUpNeg = function () {
        return this._createIcon("icon-up-dir-1", "sml", "neg");
    }

    // large positive down arrow
    Flag.prototype._createLrgDownPos = function () {
        return this._createIcon("icon-down-dir-1", "lrg", "pos");
    }

    // small positive down arrow
    Flag.prototype._createSmlDownPos = function () {
        return this._createIcon("icon-down-dir-1", "sml", "pos");
    }

    Flag.prototype._createIcon = function (iconCls, sizeCls, clrCls) {
        var div = $(document.createElement("div")).addClass('dailyflag');
        var icon = $(document.createElement("icon")).addClass(iconCls)
                                                    .addClass(sizeCls)
                                                    .addClass(clrCls);
        div.append(icon);
        return div;
    }

    Flag.prototype._createText = function (text, textCls, sizeCls) {
        var div = $(document.createElement("div")).addClass('dailyflag');
        var span = $(document.createElement("span")).addClass(textCls)
                                                      .addClass(sizeCls);
        span.text(text);
        div.append(span);
        return div;
    }

    Flag.prototype._createContainer = function (flagElem, flagHeader) {
        var container = $(document.createElement("div"));
        var header = $(document.createElement("div"));
        container.addClass("dailyflag-container");
        header.addClass("dailyflag-header");
        container.append(header);
        container.append(flagElem);
        header.text(flagHeader);
        return container;
    }

    // INTRADAY FLAG CLASS DEFINITION
    // ====================================
    var IntradayFlag = function (element, options) {
        this.$element = $(element);
        this.flag = options.flag;
        this.options = $.extend({}, IntradayFlag.DEFAULTS, options);
    }

    IntradayFlag.prototype = new Flag();
    IntradayFlag.prototype.constructor = Flag;

    // flag conditions
    IntradayFlag.conditions = {
        intradayReturn: {
            veryLow: -2.0,
            low: -1.5,
            high: 1.5,
            veryHigh: 2.0
        },
        intradayVolume: {
            veryLow: -2.0,
            low: -1.5,
            high: 2.5,
            veryHigh: 3.0
        },
        intradayLiquidity: {
            veryLow: -2.0,
            low: -1.5,
            high: 2.5,
            veryHigh: 3.0
        },
        intradaySpread: {
            veryLow: -2.0,
            low: -1.5,
            high: 2.5,
            veryHigh: 3.0
        }
    };

    // create the flag
    IntradayFlag.prototype.createFlag = function () {
        var flagElem;
        var flag = this.flag;
        var tooltipopts = IntradayFlag.TOOLTIO_OPTIONS;
        if (!flag)
            flagElem = null;
        else {
            switch (flag.flagType) {
                case Enums.intradayFlagType.RETURN:         // INTRADAY RETURN
                    if (flag.zscore < IntradayFlag.conditions.intradayReturn.veryLow)
                        flagElem = this._createLrgDownNeg();
                    else if (flag.zscore < IntradayFlag.conditions.intradayReturn.low)
                        flagElem = this._createSmlDownNeg();
                    else if (flag.zscore > IntradayFlag.conditions.intradayReturn.veryHigh)
                        flagElem = this._createLrgUpPos();
                    else if (flag.zscore > IntradayFlag.conditions.intradayReturn.high)
                        flagElem = this._createSmlUpPos();
                    break;
                case Enums.intradayFlagType.SPREAD:        // INTRADAY SPREAD
                    if (flag.zscore < IntradayFlag.conditions.intradaySpread.veryLow)
                        flagElem = this._createLrgDownPos();
                    else if (flag.zscore < IntradayFlag.conditions.intradaySpread.low)
                        flagElem = this._createSmlDownPos();
                    else if (flag.zscore > IntradayFlag.conditions.intradaySpread.veryHigh)
                        flagElem = this._createLrgUpNeg();
                    else if (flag.zscore > IntradayFlag.conditions.intradaySpread.high)
                        flagElem = this._createSmlUpNeg();
                    break;
                case Enums.intradayFlagType.LIQUIDITY:    // INTRADAY LIQUIDITY
                    if (flag.zscore < IntradayFlag.conditions.intradayLiquidity.veryLow)
                        flagElem = this._createLrgDownNeg();
                    else if (flag.zscore < IntradayFlag.conditions.intradayLiquidity.low)
                        flagElem = this._createSmlDownNeg();
                    else if (flag.zscore > IntradayFlag.conditions.intradayLiquidity.veryHigh)
                        flagElem = this._createLrgUpPos();
                    else if (flag.zscore > IntradayFlag.conditions.intradayLiquidity.high)
                        flagElem = this._createSmlUpPos();
                    break;
                case Enums.intradayFlagType.VOLUME:    // INTRADAY VOLUME
                    if (flag.zscore < IntradayFlag.conditions.intradayVolume.veryLow)
                        flagElem = this._createLrgDownNeg();
                    else if (flag.zscore < IntradayFlag.conditions.intradayVolume.low)
                        flagElem = this._createSmlDownNeg();
                    else if (flag.zscore > IntradayFlag.conditions.intradayVolume.veryHigh)
                        flagElem = this._createLrgUpPos();
                    else if (flag.zscore > IntradayFlag.conditions.intradayVolume.high)
                        flagElem = this._createSmlUpPos();
                    break;
            }
        }
        if (this.options.tooltip) {
            $(flagElem).tooltip(tooltipopts);
        }
        if (this.options.header && this.flag) {
            return this._createContainer(flagElem, DisplayUtils.intradayflagheader(this.flag.flagType));
        }
        return flagElem;
    }

    // create the flag display elements according to flag state
    IntradayFlag.prototype.init = function () {
        var flag = this.flag;
        var flagElem = this.createFlag();
        if (!flagElem)
            flagElem = this._createEmpty();

        this.$element.append(flagElem);
    }

    // INTRADAY FLAG PLUGIN DEFINITION
    // ===============================
    

    // DAILY FLAG CLASS DEFINITION
    // ==============================
    var DailyFlag = function (element, options) {
        this.$element = $(element);
        this.flag = options.flag;
        this.options = $.extend({}, DailyFlag.DEFAULTS, options);
    }

    DailyFlag.prototype = new Flag();
    DailyFlag.prototype.constructor = DailyFlag;

    // constants
    DailyFlag.TOOLTIP_OPTIONS = {
        animation: true,
        html: true,
        placement: "bottom"
    }

    DailyFlag.DEFAULTS = {
        tooltip: true
    }

    DailyFlag.lowerZscore = 1.5;
    DailyFlag.higherZscore = 2.0;
    DailyFlag.divergencePercentile = 0.9;

    // flag conditions
    DailyFlag.conditions = {
        priceAction: {
            reliability: 0.65 / percmult,
            daysAgo: 1
        },
        earnings: {
            percentile: 0.1 / percmult
        },
        valuation: {
        },
        volume: {
        },
        volatility: {
        },
        shortinterest: {
        },
        cds : {
        },
        divergenceEps: {
        }
    };

    DailyFlag.prototype._getNormTooltipContent = function () {
        var dummy = $(document.createElement("div"));
        var tbl = $(document.createElement("table"));
        tbl.addClass("dailyflag-tooltip");
        var tr1 = $(document.createElement("tr"));
        var tr2 = $(document.createElement("tr"));
        var tr3 = $(document.createElement("tr"));
        var td1 = $(document.createElement("td"));
        var td2 = $(document.createElement("td"));
        var td3 = $(document.createElement("td"));
        var td4 = $(document.createElement("td"));
        var td5 = $(document.createElement("td"));
        var td6 = $(document.createElement("td"));
        td1.css("text-align", "center");
        td2.css("text-align", "right");
        td3.css("text-align", "center");
        td4.css("text-align", "right");
        td5.css("text-align", "center");
        td6.css("text-align", "right");
        td1.text("Std Dev:");
        td5.text("Z score:");
        td3.text("Mean:");
        td2.text(this.flag.standardDeviation);
        td4.text(this.flag.mean);
        td6.text(this.flag.zscore);
        tr1.append(td1)
           .append(td2);
        tr2.append(td3)
           .append(td4);
        tr3.append(td5)
           .append(td6);
        tbl.append(tr1)
           .append(tr2)
           .append(tr3);
        dummy.append(tbl);
        return dummy.html();
    }

    DailyFlag.prototype._getPercentileTooltipContent = function () {
        var dummy = $(document.createElement("div"));
        var tbl = $(document.createElement("table"));
        tbl.addClass("dailyflag-tooltip");
        var tr1 = $(document.createElement("tr"));
        var td1 = $(document.createElement("td"));
        var td2 = $(document.createElement("td"));
        td1.css("text-align", "center");
        td2.css("text-align", "right");
        td1.text("Percentile:");
        td2.text(DisplayUtils.percentile(this.flag.percentile));
        tr1.append(td1)
           .append(td2);
        tbl.append(tr1)
        dummy.append(tbl);
        return dummy.html();
    }

    DailyFlag.prototype._getDirectorDealingToolipContent = function () {
        var dummy = $(document.createElement("div"));
        var tbl = $(document.createElement("table"));
        tbl.addClass("dailyflag-tooltip");
        if (this.flag.buyCount > 0) {
            var trb1 = $(document.createElement("tr"));
            var trb2 = $(document.createElement("tr"));
            var trb3 = $(document.createElement("tr"));
            var tdb1 = $(document.createElement("td"));
            var tdb2 = $(document.createElement("td"));
            var tdb3 = $(document.createElement("td"));
            var tdb4 = $(document.createElement("td"));
            var tdb5 = $(document.createElement("td"));
            var tdb6 = $(document.createElement("td"));
            tdb1.text("Total Buy:")
            tdb2.text(DisplayUtils.floatShort(this.flag.buyTotalValueLocal) + " (" + this.flag.sellLocalCurrencySymbol + ")");
            tdb3.text("Insider Count:");
            tdb4.text("" + this.flag.buyCount);
            tdb5.text("Last Transaction:");
            tdb6.text((-this.flag.buyDaysAgo) + " days ago");
            trb1.append(tdb1);
            trb1.append(tdb2);
            trb2.append(tdb3);
            trb2.append(tdb4);
            trb3.append(tdb5);
            trb3.append(tdb6);
            tbl.append(trb1);
            tbl.append(trb2);
            tbl.append(trb3);
        }
        if (this.flag.sellCount > 0) {
            var trs1 = $(document.createElement("tr"));
            var trs2 = $(document.createElement("tr"));
            var trs3 = $(document.createElement("tr"));
            var tds1 = $(document.createElement("td"));
            var tds2 = $(document.createElement("td"));
            var tds3 = $(document.createElement("td"));
            var tds4 = $(document.createElement("td"));
            var tds5 = $(document.createElement("td"));
            var tds6 = $(document.createElement("td"));
            tds1.text("Total Sell:")
            tds2.text(DisplayUtils.floatShort(this.flag.sellTotalValueLocal) + " (" + this.flag.sellLocalCurrencySymbol + ")");
            tds3.text("Insider Count:");
            tds4.text("" + this.flag.sellCount);
            tds5.text("Last Transaction:");
            tds6.text((-this.flag.sellDaysAgo) + " days ago");
            trs1.append(tds1);
            trs1.append(tds2);
            trs2.append(tds3);
            trs2.append(tds4);
            trs3.append(tds5);
            trs3.append(tds6);
            tbl.append(trs1);
            tbl.append(trs2);
            tbl.append(trs3);
        }
        dummy.append(tbl);
        return dummy.html();
    }

    DailyFlag.prototype._getVolumeTooltipContent = function () {
        var dummy = $(document.createElement("div"));
        var tbl = $(document.createElement("table"));
        tbl.addClass("dailyflag-tooltip");
        var tr1 = $(document.createElement("tr"));
        var tr2 = $(document.createElement("tr"));
        var td1 = $(document.createElement("td"));
        var td2 = $(document.createElement("td"));
        var td3 = $(document.createElement("td"));
        var td4 = $(document.createElement("td"));
        td1.css("text-align", "center");
        td2.css("text-align", "right");
        td3.css("text-align", "center");
        td4.css("text-align", "right");
        td1.text("Std Dev:");
        td3.text("Z score:");
        td2.text(this.flag.standardDeviation);
        td4.text(this.flag.zscore);
        tr1.append(td1)
           .append(td2);
        tr2.append(td3)
           .append(td4);
        tbl.append(tr1)
           .append(tr2);
        dummy.append(tbl);
        return dummy.html();
    }

    DailyFlag.prototype._getPriceActionTooltipContent = function () {
        var name = Technicals.getDisplayName(this.flag.technical, this.flag.signalDirection);
        var dummy = $(document.createElement("div"));
        var tbl = $(document.createElement("table"));
        tbl.addClass("dailyflag-tooltip");
        var tr1 = $(document.createElement("tr"));
        var tr2 = $(document.createElement("tr"));
        var tr3 = $(document.createElement("tr"));
        var tr4 = $(document.createElement("tr"));
        var tr5 = $(document.createElement("tr"));
        var td1 = $(document.createElement("td"));
        var td2 = $(document.createElement("td"));
        var td3 = $(document.createElement("td"));
        var td4 = $(document.createElement("td"));
        var td5 = $(document.createElement("td"));
        var td6 = $(document.createElement("td"));
        var td7 = $(document.createElement("td"));
        var td8 = $(document.createElement("td"));
        var td9 = $(document.createElement("td"));
        td1.attr("colspan", 2);
        td1.css("text-align", "center");
        td2.css("text-align", "right");
        td3.css("text-align", "center");
        td4.css("text-align", "right");
        td5.css("text-align", "right");
        td6.css("text-align", "right");
        td7.css("text-align", "right");
        td8.css("text-align", "right");
        td9.css("text-align", "right");
        td1.text(name);
        td2.text("Fired:");
        td3.text(this.flag.daysAgo + " " + (this.flag.daysAgo == 1 ? "Day Ago" : "Days Ago"));
        td4.text("Return:");
        td5.text(DisplayUtils.percentage(this.flag.return));
        td6.text("Reliability:")
        td7.text(DisplayUtils.percentage(this.flag.reliability));
        td8.text("P value:")
        td9.text(this.flag.pvalue);
        tr1.append(td1);
        tr2.append(td2)
           .append(td3);
        tr3.append(td4)
           .append(td5);
        tr4.append(td6)
           .append(td7);
        tr5.append(td8)
           .append(td9);
        tbl.append(tr1)
           .append(tr2)
           .append(tr3)
           .append(tr4)
           .append(tr5);
        dummy.append(tbl);
        return dummy.html();
    }

    DailyFlag.prototype._createCds = function (tighter, sizeCls) {
        var div = $(document.createElement("div")).addClass('dailyflag');
        var icon1 = $(document.createElement("icon")).addClass(tighter ? "icon-right-dir-1" : "icon-left-dir-1")
                                                     .addClass(sizeCls)
                                                     .addClass(tighter ? "pos" : "neg")
                                                     .addClass("cds-signal");
        var icon2 = $(document.createElement("icon")).addClass(tighter ? "icon-left-dir-1" : "icon-right-dir-1")
                                                     .addClass(sizeCls)
                                                     .addClass(tighter ? "pos" : "neg")
                                                     .addClass("cds-signal");
        div.append(icon1);
        div.append(icon2);
        return div;
    }

    DailyFlag.prototype._createDivergence = function (text, iconCls1, iconCls2) {
        var div = $(document.createElement("div")).addClass('dailyflag');
        var span1 = $(document.createElement("span")).addClass('diverg-signal');
        var span2 = $(document.createElement("span")).addClass('diverg-signal');
        span1.text("P");
        span2.text(text);
        var icon1 = $(document.createElement("icon")).addClass("sml")
                                                     .addClass("diverg-signal")
                                                     .addClass("neu")
                                                     .addClass(iconCls1);
        var icon2 = $(document.createElement("icon")).addClass("sml")
                                                     .addClass("diverg-signal")
                                                     .addClass("neu")
                                                     .addClass(iconCls2);
        div.append(span1);
        div.append(icon1);
        div.append(span2);
        div.append(icon2);
        return div;
    }

    DailyFlag.prototype._createDirectorDealings = function (text, cls) {
        var div = $(document.createElement("div")).addClass('dailyflag');
        var span = $(document.createElement("span")).addClass("dd-signal")
                                                    .addClass(cls);

        span.text(text);
        div.append(span);
        return div;
    }

    DailyFlag.prototype._createEvent = function (difference) {
        var div = $(document.createElement("div")).addClass('dailyflag');
        var span = $(document.createElement("span")).addClass("event-signal");
        
        if (difference == 0) {
            span.addClass("today");
            span.text("T");
        } else if (difference > 0) {
            span.addClass("future");
            span.text("+" + difference);
        } else {
            span.addClass("past");
            span.text(difference);
        }
        div.append(span);
        return div;
    }

    DailyFlag.prototype._createEmpty = function () {
        var div = $(document.createElement("div")).addClass('dailyflag');
        return div;
    }

    // create the flag
    DailyFlag.prototype.createFlag = function() {
        var flagElem;
        var flag = this.flag;
        var tooltipopts = DailyFlag.TOOLTIP_OPTIONS;
        if (!flag)
            flagElem = null;
        else {
            switch (flag.flagType.toLowerCase()) {
                case "priceaction":             // price action flag
                    if (!flag)
                        flagElem = null;
                    else {
                        // large up
                        if (flag.tradeDirection == Enums.buySell.BUY && flag.reliability > DailyFlag.conditions.priceAction.reliability && flag.daysAgo <= DailyFlag.conditions.priceAction.daysAgo) {
                            flagElem = this._createLrgUpPos();

                            this.direction = Enums.buySell.BUY;
                            this.pvalue = flag.pvalue;
                        }
                        // small up
                        if (flag.tradeDirection == Enums.buySell.BUY && (flag.reliability <= DailyFlag.conditions.priceAction.reliability || flag.daysAgo > DailyFlag.conditions.priceAction.daysAgo)) {
                            flagElem = this._createSmlUpPos();

                            this.direction = Enums.buySell.BUY;
                            this.pvalue = flag.pvalue;
                        }
                        // large down
                        if (flag.tradeDirection == Enums.buySell.SELL && flag.reliability > DailyFlag.conditions.priceAction.reliability && flag.daysAgo <= DailyFlag.conditions.priceAction.daysAgo) {
                            flagElem = this._createLrgDownNeg();

                            this.direction = Enums.buySell.SELL;
                            this.pvalue = flag.pvalue;
                        }
                        // small down
                        if (flag.tradeDirection == Enums.buySell.SELL && (flag.reliability <= DailyFlag.conditions.priceAction.reliability || flag.daysAgo > DailyFlag.conditions.priceAction.daysAgo)) {
                            flagElem = this._createSmlDownNeg();

                            this.direction = Enums.buySell.SELL;
                            this.pvalue = flag.pvalue;
                        }
                        tooltipopts = $.extend({}, tooltipopts, { title: this._getPriceActionTooltipContent() });
                    }
                    break;
                case "earningsestimate3m":          // earnings estimate 3month flag
                    if (flag.percentile < DailyFlag.conditions.earnings.percentile) {
                        flagElem = this._createLrgDownNeg();
                        this.direction = Enums.buySell.SELL;
                        this.pvalue = flag.percentile * percmult;
                    }
                    else if (flag.percentile > (1.0 / percmult) - DailyFlag.conditions.earnings.percentile) {
                        flagElem = this._createLrgUpPos();
                        this.direction = Enums.buySell.BUY;
                        this.pvalue = 1.0 - (flag.percentile * percmult);
                    }
                    else
                        flagElem = null;
                    tooltipopts = $.extend({}, tooltipopts, { title: this._getPercentileTooltipContent() });
                    break;
                case "earningsestimate1m":          // earnings estimate 1 month flag
                    if (flag.percentile < DailyFlag.conditions.earnings.percentile) {
                        flagElem = this._createLrgDownNeg();
                        this.direction = Enums.buySell.SELL;
                        this.pvalue = flag.percentile * percmult;
                        
                    }
                    else if (flag.percentile > (1.0 / percmult) - DailyFlag.conditions.earnings.percentile) {
                        flagElem = this._createLrgUpPos();
                        this.direction = Enums.buySell.BUY;
                        this.pvalue = 1.0 - (flag.percentile * percmult);
                    }
                    else
                        flagElem = null;
                    tooltipopts = $.extend({}, tooltipopts, { title: this._getPercentileTooltipContent() });
                    break;
                case "valuation":               // valuation flag
                    if (flag.zscore < -(DailyFlag.conditions.valuation.higherZscore || DailyFlag.higherZscore)) {
                        flagElem = this._createLrgDownPos();
                        this.direction = Enums.buySell.BUY;
                        this.pvalue = Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore < -(DailyFlag.conditions.valuation.lowerZscore || DailyFlag.lowerZscore)) {
                        flagElem = this._createSmlDownPos();
                        this.direction = Enums.buySell.BUY;
                        this.pvalue = Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore > (DailyFlag.conditions.valuation.higherZscore || DailyFlag.higherZscore)) {
                        flagElem = this._createLrgUpNeg();
                        this.direction = Enums.buySell.SELL;
                        this.pvalue = 1.0 - Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore > (DailyFlag.conditions.valuation.lowerZscore || DailyFlag.lowerZscore)) {
                        flagElem = this._createSmlUpNeg();
                        this.direction = Enums.buySell.SELL;
                        this.pvalue = 1.0 - Math.stats.distributions.normal.cdf(flag.zscore);
                    }

                    tooltipopts = $.extend({}, tooltipopts, { title: this._getNormTooltipContent() });
                    break;
                case "volume":
                    if (flag.zscore < (DailyFlag.conditions.volume.higherZscore || DailyFlag.higherZscore)) {
                        flagElem = this._createText("Low", "volume-signal", "lrg");
                        this.direction = null;
                        this.pvalue = Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore < -(DailyFlag.conditions.volume.lowerZscore || DailyFlag.lowerZscore)) {
                        flagElem = this._createText("Low", "volume-signal", "sml");
                        this.direction = null;
                        this.pvalue = Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore > (DailyFlag.conditions.volume.higherZscore || DailyFlag.higherZscore)) {
                        flagElem = this._createText("High", "volume-signal", "lrg");
                        this.direction = null;
                        this.pvalue = 1.0 - Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore > (DailyFlag.conditions.volume.lowerZscore || DailyFlag.lowerZscore)) {
                        flagElem = this._createText("High", "volume-signal", "sml");
                        this.direction = null;
                        this.pvalue = 1.0 - Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    tooltipopts = $.extend({}, tooltipopts, { title: this._getVolumeTooltipContent() });
                    break;
                case "volatility":
                    if (flag.zscore < -(DailyFlag.conditions.volatility.higherZscore || DailyFlag.higherZscore)) {
                        flagElem = this._createLrgUpPos();
                        this.direction = Enums.buySell.BUY;
                        this.pvalue = Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore < -(DailyFlag.conditions.volatility.lowerZscore || DailyFlag.lowerZscore)) {
                        flagElem = this._createSmlDownPos();
                        this.direction = Enums.buySell.BUY;
                        this.pvalue = Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore > (DailyFlag.conditions.volatility.higherZscore || DailyFlag.higherZscore)) {
                        flagElem = this._createLrgUpNeg();
                        this.direction = Enums.buySell.SELL;
                        this.pvalue = 1.0 - Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore > (DailyFlag.conditions.volatility.lowerZscore || DailyFlag.lowerZscore)) {
                        flagElem = this._createSmlUpNeg();
                        this.direction = Enums.buySell.SELL;
                        this.pvalue = 1.0 - Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    tooltipopts = $.extend({}, tooltipopts, { title: this._getNormTooltipContent() });
                    break;
                case "shortinterest":
                    if (flag.zscore < -(DailyFlag.conditions.shortinterest.higherZscore || DailyFlag.higherZscore)) {
                        flagElem = this._createLrgUpPos();
                        this.direction = Enums.buySell.BUY;
                        this.pvalue = Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore < -(DailyFlag.conditions.shortinterest.lowerZscore || DailyFlag.lowerZscore)) {
                        flagElem = this._createSmlDownPos();
                        this.direction = Enums.buySell.BUY;
                        this.pvalue = Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore > (DailyFlag.conditions.shortinterest.higherZscore || DailyFlag.higherZscore)) {
                        flagElem = this._createLrgUpNeg();
                        this.direction = Enums.buySell.SELL;
                        this.pvalue = 1.0 - Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore > (DailyFlag.conditions.shortinterest.lowerZscore || DailyFlag.lowerZscore)) {
                        flagElem = this._createSmlUpNeg();
                        this.direction = Enums.buySell.SELL;
                        this.pvalue = 1.0 - Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    tooltipopts = $.extend({}, tooltipopts, { title: this._getNormTooltipContent() });
                    break;
                case "cds":
                    if (flag.zscore < -(DailyFlag.conditions.cds.higherZscore || DailyFlag.higherZscore)) {
                        flagElem = this._createCds(true, "med");
                        this.direction = Enums.buySell.BUY;
                        this.pvalue = Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore < -(DailyFlag.conditions.cds.lowerZscore || DailyFlag.lowerZscore)) {
                        flagElem = this._createCds(true, "sml");
                        this.direction = Enums.buySell.BUY;
                        this.pvalue = Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore > (DailyFlag.conditions.cds.higherZscore || DailyFlag.higherZscore)) {
                        flagElem = this._createCds(false, "med");
                        this.direction = Enums.buySell.SELL;
                        this.pvalue = 1.0 - Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    else if (flag.zscore > (DailyFlag.conditions.cds.lowerZscore || DailyFlag.lowerZscore)) {
                        flagElem = this._createCds(false, "sml");
                        this.direction = Enums.buySell.SELL;
                        this.pvalue = 1.0 - Math.stats.distributions.normal.cdf(flag.zscore);
                    }
                    tooltipopts = $.extend({}, tooltipopts, { title: this._getNormTooltipContent() });
                    break;
                case "divergenceeps":
                    if (flag.percentile > (DailyFlag.conditions.divergenceEps.percentile || DailyFlag.divergencePercentile)) {
                        flagElem = this._createDivergence("EPS", flag.direction == Enums.upDown.UP ? "icon-up-dir-1" : "icon-down-dir-1",
                                                                 flag.direction == Enums.upDown.UP ? "icon-down-dir-1" : "icon-up-dir-1");
                        this.direction = null;
                        this.pvalue = 1.0 - flag.percentile;
                    }
                    tooltipopts = $.extend({}, tooltipopts, { title: this._getPercentileTooltipContent() });
                    break;
                case "divergenceskew":
                    if (flag.percentile > (DailyFlag.conditions.divergenceEps.percentile || DailyFlag.divergencePercentile)) {
                        flagElem = this._createDivergence("VOL", flag.direction == Enums.upDown.UP ? "icon-up-dir-1" : "icon-up-dir-1",
                                                                 flag.direction == Enums.upDown.UP ? "icon-down-dir-1" : "icon-down-dir-1");
                        this.direction = null;
                        this.pvalue = 1.0 - flag.percentile;
                    }
                    tooltipopts = $.extend({}, tooltipopts, { title: this._getPercentileTooltipContent() });
                    break;
                case "divergencesi":
                    if (flag.percentile > (DailyFlag.conditions.divergenceEps.percentile || DailyFlag.divergencePercentile)) {
                        flagElem = this._createDivergence("SI", flag.direction == Enums.upDown.UP ? "icon-up-dir-1" : "icon-up-dir-1",
                                                                 flag.direction == Enums.upDown.UP ? "icon-down-dir-1" : "icon-down-dir-1");
                        this.direction = null;
                        this.pvalue = 1.0 - flag.percentile;
                    }
                    tooltipopts = $.extend({}, tooltipopts, { title: this._getPercentileTooltipContent() });
                    break;
                case "divergencecds":
                    if (flag.percentile > (DailyFlag.conditions.divergenceEps.percentile || DailyFlag.divergencePercentile)) {
                        flagElem = this._createDivergence("CDS", flag.direction == Enums.upDown.UP ? "icon-up-dir-1" : "icon-up-dir-1",
                                                                 flag.direction == Enums.upDown.UP ? "icon-down-dir-1" : "icon-down-dir-1");
                        this.direction = null;
                        this.pvalue = 1.0 - flag.percentile;
                    }
                    tooltipopts = $.extend({}, tooltipopts, { title: this._getPercentileTooltipContent() });
                    break;
                case "event":
                    if (!flag)
                        flagElem = this._createEmpty();
                    else {
                        flagElem = this._createEvent(flag.dayDifference);
                        this.direction = null;
                        this.pvalue = 0.05;
                    }
                    break;
                case "directordealing":
                    if (!flag)
                        flagElem = this._createEmpty();
                    else {
                        var cls = "";
                        var text = "";
                        if (flag.buyCount > 0 && flag.sellCount > 0) {
                            cls = "buysell";
                            text = "" + (flag.buyDaysAgo > flag.sellDaysAgo ? flag.buyDaysAgo : flag.sellDaysAgo);
                        }
                        else if (flag.buyCount > 0) {
                            cls = "buy";
                            text = "" + flag.buyDaysAgo;
                        }
                        else if (flag.sellCount > 0) {
                            cls = "sell";
                            text = "" + flag.sellDaysAgo;
                        }
                        flagElem = this._createDirectorDealings(text, cls);
                    }
                    tooltipopts = $.extend({}, tooltipopts, { title: this._getDirectorDealingToolipContent() });
                    break;
            }
        }

        if (this.options.tooltip && flagElem) {
            $(flagElem).tooltip(tooltipopts);
        }
        if (this.options.header && this.flag && flagElem) {
            return this._createContainer(flagElem, DisplayUtils.dailyflagheader(this.flag.flagType));
        }
        return flagElem;
    }

    // create the flag display elements according to flag state
    DailyFlag.prototype.init = function () {
        var flag = this.flag;
        var flagElem = this.createFlag();
        if (!flagElem)
            flagElem = this._createEmpty();

        this.$element.append(flagElem);
    }

    // DAILY FLAG PLUGIN DEFINITION
    // ===============================
    var old = $.fn.dailyFlag;

    $.fn.dailyFlag = function (option) {

        return this.each(function () {
            var $this = $(this);
            
            var data = $this.data('otas.dailyFlag');

            if (!data) $this.data('otas.dailyFlag', (data = new DailyFlag(this, option)))
            data.init();
        })
    }

    $.fn.dailyFlag.constructor = DailyFlag;

    // DAILY FLAG NO CONFLICT
    // =========================

    $.fn.dailyFlag.noConflict = function () {
        $.fn.dailyFlag = old;
        return this;
    }

    // DAILY FLAG DATA API
    // ======================
    $(document).ready(function () {
        $('.dailyflag-load').each(function () {
            var $this = $(this);
            var stock = $this.data("stock");
            var date = $this.data("date");
            var topic = $this.data("topic");
            var url = window.otasBase.baseUrl + "stock/" + stock + "/dailyflags";
            Data.api.v1.stock(stock).dailyFlags({ date: date, topic: topic }, function (flag) {
                $this.dailyFlag({ flag: flag[topic], tooltip: $this.data("tooltip"), header: $this.data("header") });
            });
        });
    });

    // DAILY FLAG ROW CLASS DEFINITION
    // ===============================
    var DailyFlagRow = function (element, options) {
        this.$element = $(element);
        this.flags = options.flags;
        this.options = $.extend({}, DailyFlagRow.DEFAULTS, options);
    }

    // constants
    DailyFlagRow.DEFAULTS = {
        flagOrder: [
            Enums.dailyFlagType.RETURNVSSECTOR1D,
            Enums.dailyFlagType.PRICEACTION,
            Enums.dailyFlagType.VOLUME,
            Enums.dailyFlagType.EARNINGSESTIMATE1M,
            Enums.dailyFlagType.DIRECTORDEALING,
            Enums.dailyFlagType.VALUATION,
            Enums.dailyFlagType.VOLATILILTY,
            Enums.dailyFlagType.SHORTINTEREST,
            Enums.dailyFlagType.CDS,
            Enums.dailyFlagType.DIVERGENCEEPS,
            Enums.dailyFlagType.DIVERGENCESKEW,
            Enums.dailyFlagType.DIVERGENCESI,
            Enums.dailyFlagType.DIVERGENCECDS,
            Enums.dailyFlagType.EVENT
        ]
    }

    DailyFlagRow.prototype.init = function () {
        this.$element.addClass("dailyflagrow-container");
        // iterate over flags
        var dfs = new Array();
        for (var i = 0; i < this.options.flagOrder.length; i++) {
            var df = new DailyFlag(null, { flag: this.flags[this.options.flagOrder[i]], header: true, tooltip: this.options.tooltip });
            var flagElem = df.createFlag();
            if (flagElem)
                this.$element.append(flagElem);
            dfs.push(df);
        }
        this.dailyFlags = dfs;
    }

    // DAILY FLAG ROW PLUGIN DEFINITION
    // ===============================
    var old = $.fn.dailyFlagRow;

    $.fn.dailyFlagRow = function (option) {
        return this.each(function () {
            var $this = $(this);

            var data = $this.data('otas.dailyFlagRow');

            if (!data) $this.data('otas.dailyFlagRow', (data = new DailyFlagRow(this, option)))
            data.init();
        })
    }

    // DAILY FLAG ROW NO CONFLICT
    // =========================

    $.fn.dailyFlagRow.noConflict = function () {
        $.fn.dailyFlagRow = old;
        return this;
    }

    // DAILY FLAG ROW DATA API
    // ======================
    $(document).ready(function () {
        $('.dailyflagrow-load').each(function () {
            var $this = $(this);
            var stock = $this.data("stock");
            var date = $this.data("date");
            // separate request for each element - need to optimise
            Data.api.v1.stock(stock).dailyFlags({ date: date }, function (flags) {
                $this.dailyFlagRow({ flags: flags, tooltip: $this.data("tooltip") })
            });
        });
    });

    // DAILY FLAG LIST CLASS DEFINITION
    // ================================
    var DailyFlagList = function (element, options) {
        this.$element = $(element);
        this.options = $.extend({}, DailyFlagList.DEFAULTS, options);
    }

    DailyFlagList.COLUMNS = {
        name: {
            header: "Stock",
            create: function (row) {
                return $(document.createElement("div")).stockDescriptor({ stock: row.stock, small: true, noBackground: true });
            },
            name: "stock"
        },
        signals: {
            header: "Signals",
            create: function (row) {
                return $(document.createElement("div")).dailyFlagRow({ flags: row.stock.flags });
            },
            name: "signals"
        }
    }

    // constants
    DailyFlagList.DEFAULTS = {
        columns: [DailyFlagList.COLUMNS.name, DailyFlagList.COLUMNS.signals]
    }

    DailyFlagList.prototype.init = function () {
        var stocks = this.options.stocks;
        var cols = this.options.columns;
        var tbl = $(document.createElement("table")).addClass("dashboard");
        for (var i = 0; i < stocks.length; i++) {
            var tr = $(document.createElement("tr"));
            tbl.append(tr);
            tr.data("stock", stocks[i]);
            var cells = new Object();
            for (var j = 0; j < cols.length; j++) {
                var td = $(document.createElement("td"));
                var content = cols[j].create({ stock: stocks[i] });
                td.append(content);
                tr.append(td);
                cells[cols[j].name] = content;
            }
            tr.data("cells", cells);
        }
        this.$element.append(tbl);
    }

    DailyFlagList.prototype.sort = function (sortFunction) {
        this.$element.find("tr").tsort({
            sortFunction: function (a, b) {
                return sortFunction({ stock: a.e.data("stock"), cells: a.e.data("cells") }, { stock: b.e.data("stock"), cells: b.e.data("cells") });
            }
        });
    }

    // DAILY FLAG LIST PLUGIN DEFINITION
    // =================================

    var old = $.fn.dailyFlagList;

    $.fn.dailyFlagList = function (option, arg) {
        return this.each(function () {
            var $this = $(this);

            var data = $this.data('otas.dailyFlagList');

            if (!data) {
                $this.data('otas.dailyFlagList', (data = new DailyFlagList(this, option)))
                data.init();
            }
            if (typeof option == 'string') data[option].call(data, arg)
        })
    }

    // DAILY SERIES CLASS DEFINITION
    // =======================
    var DailySeries = function (options, element) {
        
        this.$element = $(element);
        DailySeries.highchartOptions.title.text = options.chartTitle;
        this.options = $.extend({}, DailySeries.DEFAULTS, options);
       
        var parseSeries = function (series) {
            var ps = new Array(series.length);
            for (var i = 0; i < series.length; i++) {
                ps[i] = {
                    date: new Date(series[i].date),
                    value: series[i].value
                };
            }
            return ps;
        }

        if (this.options.series) {
            // parse all the dates
            this._series = parseSeries(this.options.series)            
        }
    }

    DailySeries.highchartOptions = {
        chart: {
            type: 'line'
        },
        title: {
            text: ''
        },
        xAxis: {
            type: 'datetime'
        },
        plotOptions: {
            line: {
                marker: {
                    enabled: false
                }
            }
        }
    };

    DailySeries.DEFAULTS = {
        
    };

    DailySeries.prototype.getHighchartSeries = function () {
        var hs = new Array(this._series.length);
        for (var i = 0; i < this._series.length; i++) {
            hs[i] = [ this._series[i].date.getTime(), this._series[i].value ]
        }
        return { name: this.name, data: hs };
        
    }

    DailySeries.prototype.getHighchartOptions = function (options) {
        return $.extend({}, DailySeries.highchartOptions, this.options.highchartOptions, options, { series: [this.getHighchartSeries()] });
    }

    DailySeries.prototype.getSeries = function () {
        return this._series;
    }   

    DailySeries.prototype.plot = function (options) {
        var ho = $.extend({}, DailySeries.highchartOptions, this.options.highchartOptions, options, { series: [this.getHighchartSeries()] });
        this.$element.highcharts(ho);
    }

    // DAILY SERIES PLUGIN DEFINITION
    // ==============================

    var old = $.fn.dailySeries;

    $.fn.dailySeries = function (option) {
        
        return this.each(function () {
            var $this = $(this);

            var data = $this.data('otas.dailySeries');

            if (!data) $this.data('otas.dailySeries', (data = new DailySeries(option, this)))
            data.plot();
        })
    }

    // STOCK DESCRIPTOR CLASS DEFINITION
    // =================================
    var StockDescriptor = function (element, options) {
        this.$element = $(element);
        this.options = $.extend({}, StockDescriptor.DEFAULTS, options);
        this.stock = options.stock;
    }

    StockDescriptor.DEFAULTS = {

    }

    StockDescriptor.prototype.init = function () {
        var stock = this.stock;
        var container = $(document.createElement("div")).addClass("stock-descriptor");
        if (this.options.small)
            container.addClass("sml");
        if (this.options.noBackground)
            container.css("background-color", "transparent");
        var header = $(document.createElement("div")).addClass("header");
        header.text(stock.name);
        var sector = $(document.createElement("div")).addClass("sector");
        var sectorIcon = $(document.createElement("span")).addClass("glyphicon glyphicon-cog");
        var sectorText = $(document.createElement("span"));
        sector.append(sectorIcon);
        sector.append(sectorText);
        sectorText.text(stock.sector);
        var country = $(document.createElement("div")).addClass("country");
        var countryIcon = $(document.createElement("span")).addClass("glyphicon glyphicon-globe");
        var countryText = $(document.createElement("span"));
        country.append(countryIcon);
        country.append(countryText);
        countryText.text(stock.country);
        var mktcap = $(document.createElement("div")).addClass("mktcap");
        mktcap.text("MKT CAP: USD " + DisplayUtils.floatShort(stock.marketCapUSD * 1e6) + ", EUR " + DisplayUtils.floatShort(stock.marketCapEuro * 1e6));         // TODO, remove multiplier
        container.append(header);
        container.append(sector);
        container.append(country);
        container.append(mktcap);
        this.$element.append(container);
    }

    // STOCK DESCRIPTOR PLUGIN DEFINITION
    // ==================================

    var old = $.fn.stockDescriptor;

    $.fn.stockDescriptor = function (option) {
        return this.each(function () {
            var $this = $(this);

            var data = $this.data('otas.stockDescriptor');

            if (!data) $this.data('otas.stockDescriptor', (data = new StockDescriptor(this, option)))
            data.init();
        })
    }

    // STOCK DESCRIPTOR DATA API
    // =========================
    $(document).ready(function () {
        $('.stock-descriptor-load').each(function () {
            var $this = $(this);
            var stock = $this.data("stock");
            var small = $this.data("small");

            Data.api.v1.stock(stock)(function (data) {
                $this.stockDescriptor({ stock: data, small: small });
            });
        });
    });


    // STOCK PEERS CLASS DEFINITION
    // =================================
    var StockPeers = function (element, options) {
        this.$element = $(element);
        this.options = $.extend({}, StockPeers.DEFAULTS, options);
        this.peers = options.stock;
        this.isPeerDailyFlag = options.peerDailyFlag;
    }

    StockPeers.DEFAULTS = {

    }

    StockPeers.prototype.init = function () {
        var peers = this.peers;
        //console.log(peers);
        var container = $(document.createElement("table")).addClass("dashboard");        
        var header = $(document.createElement("th"));
        header.text('Peers');
        container.append(header);
        var tbody = $(document.createElement("tbody"));
        container.append(header);
        var peerDailyFlag = this.isPeerDailyFlag;

        $.each(peers, function (index) {
            var peer = peers[index].otasSecurityId;

            var peerRow = $(document.createElement("tr"));
            container.append(peerRow);

            var peerName = $(document.createElement("td"));
            window.otasBase.data.api.v1.stock(peer)(function(peer) {
                $(peerName).stockDescriptor({ stock: peer });
            });

            if (peerDailyFlag === true || peerDailyFlag ==='true') {
                var peerFlagRow = $(document.createElement("tr"));
                container.append(peerFlagRow);

                var peerDailyFlagRow = $(document.createElement("td"));
                window.otasBase.data.api.v1.stock(peer).dailyFlags({}, function (flags) {
                    $(peerDailyFlagRow).dailyFlagRow({ flags: flags })
                });
                peerFlagRow.append(peerDailyFlagRow);
            }

            peerRow.append(peerName);

        });

        this.$element.append(container);
    }

    // STOCK PEERS PLUGIN DEFINITION
    // ==================================

    var old = $.fn.stockPeers;

    $.fn.stockPeers = function (option) {
        return this.each(function () {
            var $this = $(this);

            var data = $this.data('otas.stockPeers');

            if (!data) $this.data('otas.stockPeers', (data = new StockPeers(this, option)))
            data.init();
        })
    }

    // STOCK PEERS DATA API
    // =========================
    $(document).ready(function () {
        $('.stock-peer').each(function () {
            var $this = $(this);
            var stock = $this.data("stock");            
            var peerDailyFlag = $this.data("dailyflag");

            Data.api.v1.stock(stock).stockPeers(function (peers) {
                $this.stockPeers({ stock: peers, peerDailyFlag: peerDailyFlag })
            });
        });
    });

    // STOCK PEERS NO CONFLICT
    // =========================

    $.fn.stockPeers.noConflict = function () {
        $.fn.stockPeers = old;
        return this;
    }


    // STAMP CLASS DEFINITION
    // =================================
    var Stamp = function (element, options) {        
        this.$element = $(element);
        this.options = $.extend({}, Stamp.DEFAULTS, options);
        this.stamp = options.stock;
    }

    Stamp.DEFAULTS = {

    }

    Stamp.prototype.init = function () {
        //console.log(':::stamp:::', this.stamp);

        var container = $(document.createElement("div"));                        
        var importedSVGRootElement = document.importNode(this.stamp.documentElement, true);
        $(importedSVGRootElement).removeAttr('style');
        container.append(importedSVGRootElement);

        this.$element.append(container);
    }

    // STOCK STAMP PLUGIN DEFINITION
    // ==================================

    var old = $.fn.stockStamp;

    $.fn.stockStamp = function (option) {        
        return this.each(function () {
            var $this = $(this);

            var data = $this.data('otas.stockStamp');
           
            if (!data) $this.data('otas.stockStamp', (data = new Stamp(this, option)))
            data.init();
        })
    }

    // STOCK STAMP DATA API
    // =========================
    $(document).ready(function () {
        $('.stock-stamp').each(function () {
            var $this = $(this);
            var stock = $this.data("stock");
            var topic = $this.data("topic");
            var header = $this.data("header");

            Data.api.v1.stock(stock).stockStamps({ stock: stock, topic: topic, isHeader: header }, function (stamp) {
                $this.stockStamp({ stock: stamp })
            });
        });
    });


    // STOCK STAMP NO CONFLICT
    // =========================

    $.fn.stockStamp.noConflict = function () {
        $.fn.stockStamp = old;
        return this;
    }

    // STAMP ROW CLASS DEFINITION
    // =================================
    var StampRow = function (element, options) {
        this.$element = $(element);
        this.options = $.extend({}, StampRow.DEFAULTS, options);
        this.stock = options.stock;
        this.header = options.isHeader;
    }

    // constants
    StampRow.DEFAULTS = {
        stampOrder: [
                Enums.stampType.PERFORMANCE,
                Enums.stampType.PRICEACTION,
                Enums.stampType.VOLUME,
                Enums.stampType.EARNINGSESTIMATE,
                Enums.stampType.DIRECTORDEALING,
                Enums.stampType.VALUATION,
                Enums.stampType.VOLATILITY,
                Enums.stampType.SHORTINTERESTDATAEXPLORER,
                Enums.stampType.SHORTINTERESTSUNGUARD,
                Enums.stampType.CDS,
                Enums.stampType.DIVERGENCEDATAEXPLORER,
                Enums.stampType.DIVERGENCESUNGUARD,
                Enums.stampType.EVENT,
                Enums.stampType.DIVIDEND            
            ]
    }

    StampRow.prototype.init = function () {        
        var container = $(document.createElement("div"));
        container.addClass('stock-stamp-svg-cont');

        var looper = $.Deferred().resolve();

        var topic = [];
        for (var key in this.options.stampOrder) {
            topic.push(this.options.stampOrder[key]);
        }        
        console.log(topic);

        var stock = this.stock;
        var header = this.header;
        var elem = this.$element;

        /*$.each(this.options.stampOrder, function (i) {
            console.log(topic[i]+'<br/>');
            looper = looper.then(function() {
                Data.api.v1.stock(stock).stockStamps({ stock: stock, topic: topic[i], isHeader: header }, function (stamp) {
                    var importedSVGRootElement = document.importNode(stamp.documentElement, true);
                    //$(importedSVGRootElement).removeAttr('style');
                    container.append(importedSVGRootElement);
                });
            }).done(function (response){                
                elem.append(container);
            });            
        });*/

        $.each(topic, function (i) {
            //console.log(topic[i]);
            $.when(Data.api.v1.stock(stock).stockStamps({ stock: stock, topic: topic[i], isHeader: header })).done(function (stamp) {
                var importedSVGRootElement = document.importNode(stamp.documentElement, true);
                //$(importedSVGRootElement).removeAttr('style');
                container.append(importedSVGRootElement);
                elem.append(container)
            });
        });
    }

    // STOCK STAMP ROW PLUGIN DEFINITION
    // ==================================

    var old = $.fn.stockStampRow;

    $.fn.stockStampRow = function (option) {
        return this.each(function () {
            var $this = $(this);

            var data = $this.data('otas.stockStampRow');

            if (!data) $this.data('otas.stockStampRow', (data = new StampRow(this, option)))
            data.init();
        })
    }

    // STOCK STAMP ROW DATA API
    // =========================
    $(document).ready(function () {
        $('.stock-stamp-row').each(function () {
            var $this = $(this);
            var stock = $this.data("stock");            
            var header = $this.data("header");

            Data.api.v1.stock(stock)(function (stock) {                
                $this.stockStampRow({ stock: '953133', isHeader: header });
            });
        });
    });

    // STOCK STAMP NO CONFLICT
    // =========================

    $.fn.stockStampRow.noConflict = function () {
        $.fn.stockStampRow = old;
        return this;
    }

    // LIST CLASS DEFINITION
    // =================================
    var List = function (element, options) {
        this.$element = $(element);
        this.options = $.extend({}, StampRow.DEFAULTS, options);
        this.list = options.list;        
    }    

    List.prototype.init = function () {
        
        var container = $(document.createElement("table")).addClass("dashboard");        
        //var header = $(document.createElement("th"));
        //header.text('List');
        //container.append(header);
        var tbody = $(document.createElement("tbody"));
        container.append(tbody);

        var hRow = $(document.createElement("tr"));

        var hCellId = $(document.createElement("td"));
        hCellId.text('ID');
        hRow.append(hCellId);

        var hCellPublic = $(document.createElement("td"));
        hCellPublic.text('Public?');
        hRow.append(hCellPublic);

        var hCellName = $(document.createElement("td"));
        hCellName.text('Name');
        hRow.append(hCellName);

        var hCellOwnerName = $(document.createElement("td"));
        hCellOwnerName.text('Owner');
        hRow.append(hCellOwnerName);

        var hCellType = $(document.createElement("td"));
        hCellType.text('Type');
        hRow.append(hCellType);        

        container.append(hRow);

        var list = this.list;        

        $.each(list, function (indx) {
            var securityListId = list[indx].securityListId;            
            var securityListIsPublic = list[indx].securityListIsPublic;
            var securityListName = list[indx].securityListName;
            var securityListOwnerName = list[indx].securityListOwnerName;
            var securityListType = list[indx].securityListType;

            var listTr = $(document.createElement("tr"));

            var idTd = $(document.createElement("td"));
            idTd.text(securityListId);
            listTr.append(idTd);

            var isPublicTd = $(document.createElement("td"));
            isPublicTd.text(securityListIsPublic ? "Yes" : "No");
            listTr.append(isPublicTd);

            var nameTd = $(document.createElement("td"));
            nameTd.text(securityListName);
            listTr.append(nameTd);

            var ownerNameTd = $(document.createElement("td"));
            ownerNameTd.text(securityListOwnerName);
            listTr.append(ownerNameTd);

            var listTypeTd = $(document.createElement("td"));
            listTypeTd.text(securityListType);
            listTr.append(listTypeTd);

            container.append(listTr);
        })

        this.$element.append(container);        
    }

    // LIST PLUGIN DEFINITION
    // ==================================

    var old = $.fn.list;

    $.fn.list = function (option) {
        return this.each(function () {
            var $this = $(this);

            var data = $this.data('otas.list');

            if (!data) $this.data('otas.list', (data = new List(this, option)))
            data.init();
        })
    }

    // LIST DATA API
    // =========================
    $(document).ready(function () {
        $('.list').each(function () {
            var $this = $(this);
            var type = $this.data("type");            

            Data.api.v1.lists({ type: type })(function (list) {
                $this.list({ list: list });
            });
        });
    });

    // LIST NO CONFLICT
    // =========================

    $.fn.list.noConflict = function () {
        $.fn.list = old;
        return this;
    }


    window.otasBase = {
        dailyFlag: DailyFlag,
        enums: Enums,
        technicals: Technicals,
        baseUrl: "https://staging01.olivetree-solutions.com/otasbase/api/data",
        stampUrl: "http://main.olivetree-solutions.com/graphics_3_16/stamps",
        DailySeries: DailySeries,
        data: Data
    };

}(window.jQuery);