window.PayBmCheckout = (function () {
    "use strict";

    var self = {
            actionURL: "https://pay.bm.pl/payment",
            transactionSuccess: function (result) { },
            transactionDeclined: function (result) { },
            transactionError: function (result) { },
            transactionStartByParams: transactionStartByParams,
            transactionStartByUrl: transactionStartByUrl
        };

    var browserView = undefined,
        browserDetector = {
            isAndroid: function () {
                return navigator.userAgent.match(/Android/i);
            },
            isMobileiOS: function () {
                return navigator.userAgent.match(/iPhone|iPad|iPod/i);
            },
            isWebiOS: function () {
                return navigator.userAgent.match(/Apple.*Mobile(?!.*Safari)/i);
            },
            isWindows: function () {
                return navigator.userAgent.match(/IEMobile/i) || navigator.userAgent.match(/WPDesktop/i);
            },
            isBlackBerry: function () {
                return navigator.userAgent.match(/BlackBerry/i);
            },
            isOpera: function () {
                return navigator.userAgent.match(/Opera Mini/i);
            },
            isMobile: function () {
                return browserDetector.isAndroid() || browserDetector.isBlackBerry()
                    || browserDetector.isOpera() || browserDetector.isWindows()
                    || (browserDetector.isMobileiOS() && !browserDetector.isWebiOS());
            }
        },
        statuses = {
            paywaylistLoaded: {
                name: "PAYWAYLIST_LOADED",
                message: "Nie wskazano kartowego kanału płatności."
            },
            cardsLoaded: {
                name: "CARDS_LOADED",
                message: "Załadowano stronę formularza do wprowadzania numeru karty/cvc."
            },
            paid: {
                name: "PAID",
                message: "Transakcja zakończona pomyślnie."
            },
            declined: {
                name: "DECLINED",
                message: "Odmowa autoryzacji."
            },
            bankDisabled: {
                name: "BANK_DISABLED",
                message: "Przepraszamy. Aktualnie nie możemy zrealizować Twojej transakcji. Bank jest chwilowo niedostępny."
            },
            blockMultipleTransactions: {
                name: "BLOCK_MULTIPLE_TRANSACTIONS",
                message: "Przepraszamy. Transakcja już istnieje i oczekuje na wpłatę."
            },
            blockPaidTransactions: {
                name: "BLOCK_PAID_TRANSACTIONS",
                message: "Przepraszamy. Transakcja została już opłacona. Nie możesz wykonać płatności ponownie."
            },
            generalError: {
                name: "GENERAL_ERROR",
                message: "Przepraszamy. Aktualnie nie możemy zrealizować Twojej transakcji. Zapraszamy później."
            },
            insufficientStartAmount: {
                name: "INSUFFICIENT_START_AMOUNT",
                message: "Przepraszamy. Niedozwolona kwota transakcji."
            },
            outdatedError: {
                name: "OUTDATED_ERROR",
                message: "Czas płatności upłynął."
            },
            internalServerError: {
                name: "INTERNAL_SERVER_ERROR",
                message: "Upsss.. nie powiodło się :(. Pracujemy nad rozwiązaniem problemu. Spróbuj później."
            }
        };

    function getRequestUrl(params) {
        var requestParams = [];

        for (var key in params) {
            if (params.hasOwnProperty(key)) {
                if (!!params[key]) {
                    requestParams.push(key + "=" + params[key]);
                }
            }
        }

        return self.actionURL + "?" + requestParams.join("&");
    }

    function transactionStartByParams(params) {
        openPaymentView(getRequestUrl(params));
    }

    function transactionStartByUrl(url) {
        url = url + "?screenType=IFRAME";
        openPaymentView(url);
    }

    function openPaymentView(url) {
        if (browserDetector.isMobile()) {
            browserView = PayBmMobileView(url);
            browserView.open();
            return;
        }
        browserView = PayBmDesktopView(url);
        browserView.open();
    }

    function closePaymentView() {
        if (!!browserView) {
            browserView.close();
        }
    }

    function addEventListener(target, event, callback) {
        if (target.attachEvent) {
            return target.attachEvent("on" + event, callback);
        }

        return target.addEventListener(event, callback, false);
    }

    addEventListener(window, "message", function (event) {
        if (event.origin.search(/.bm.pl/) == -1) {
            var console = console || { warn: function (msg, data) { } };
            console.warn("PayBm event origin not match", event);
            return;
        }
        var eventName = "",
            eventData = {};
        try {
            eventName = event.data;
            eventData = JSON.parse(event.data.split("||")[1])
        } catch (e) {
            eventName = "";
            eventData = {};
        }
        if (eventName.indexOf("PayBmSuccess") == 0) {
            if (!!eventData.status && eventData.status == statuses.cardsLoaded.name) {
                browserView.init();
            } else if (!!eventData.status && eventData.status == statuses.paid.name) {
                closePaymentView();
                self.transactionSuccess.apply(this, [eventData]);
            } else {
                closePaymentView();
                self.transactionError.apply(this, [eventData]);
            }
        } else if (eventName.indexOf("PayBmDeclined") == 0) {
            closePaymentView();
            self.transactionDeclined.apply(this, [eventData]);

        } else if (event.data.indexOf("PayBmError") == 0) {
            closePaymentView();
            self.transactionError.apply(this, [eventData]);

        // } else {
            // closePaymentView();
            // self.transactionError.apply(this, [{status: statuses.generalError.name, message: "unknown postMessage event"}]);
        }
    });

    return self;

}).call(this);

function PayBmDesktopView(requestUrl) {
    var iframeInit, iframePayment = undefined;

    function getIframeStyle(frame) {
        frame.setAttribute("frameBorder", "0");
        frame.setAttribute("allowtransparency", "true");

        frame.style.position = "fixed";
        frame.style.display = "block";
        frame.style.top = "0";
        frame.style.left = "0";
        frame.style.width = "100%";
        frame.style.height = "100%";
        frame.style.zIndex = "9999999999";
        frame.style.border = "0px none transparent";
        frame.style.overflowX = "hidden";
        frame.style.overflowY = "auto";
        frame.style.visibility = "visible";
        frame.style.margin = "0px";
        frame.style.padding = "0px";
        frame.style.transform = "scale(0)";
        frame.style.transition = "all .3s linear 0s";

        return frame;
    }

    function open() {
        iframeInit = document.createElement("iframe");
        iframeInit.setAttribute("id", "payBmIframeInit");
        iframeInit = getIframeStyle(iframeInit);
        iframeInit.style.display = "block";

        iframePayment = document.createElement("iframe");
        iframePayment.setAttribute("id", "payBmIframePayment");
        iframePayment = getIframeStyle(iframePayment);
        iframePayment.style.display = "none";

        var body = document.body || document.getElementsByTagName("body")[0];
        var contentInit = '<html> <head> <meta http-Equiv="Cache-Control" Content="no-cache" /> <meta http-Equiv="Pragma" Content="no-cache" /> <meta http-Equiv="Expires" Content="0" /> <style type="text/css"> html, body, div, span, object, iframe, h1, h2, h3, h4, h5, h6, p, blockquote, pre, abbr, address, cite, code, del, dfn, em, img, ins, kbd, q, samp, small, strong, sub, sup, var, b, i, dl, dt, dd, ol, ul, li, fieldset, form, label, legend, table, caption, tbody, tfoot, thead, tr, th, td, article, aside, canvas, details, figcaption, figure, footer, header, hgroup, menu, nav, section, summary, time, mark, audio, video { margin: 0; padding: 0; border: 0; outline: 0; font-size: 100%; vertical-align: baseline; background: transparent; } body { line-height: 1; } :focus { outline: 0; } table { border-collapse: separate; border-spacing: 0; } caption, th, td { text-align: left; font-weight: normal; } blockquote, q { quotes: "" ""; } cite { &:before { content: "„"; } &:after { content: "\201D"; } } a img { border: 0; } html { -webkit-text-size-adjust: 100%; } * { -webkit-box-sizing: border-box; -moz-box-sizing: border-box; box-sizing: border-box; font-family: sans-serif; font-size: 12px; line-height: 16px; -webkit-text-stroke: rgba(255, 255, 255, 0.01) .01px; -webkit-font-smoothing: antialiased; font-smoothing: antialiased; font-style: normal; font-weight: 400 } a { color: inherit; text-decoration: none; outline: none !important; } a:hover { text-decoration: none; } html { -webkit-text-size-adjust: none; height: 100% } body { background: rgba(0, 0, 0, 0) none repeat scroll 0 0; height: 100%; position: relative; } .spinner { display: none; width: 23px; height: 23px; position: relative; margin: 20px auto } .preloader { opacity: 1; position: fixed; top: 50%; left: 50%; -webkit-transform: translate(-50%, -50%); -moz-transform: translate(-50%, -50%); -ms-transform: translate(-50%, -50%); transform: translate(-50%, -50%) } .spin.loading { display: none; width: 23px; height: 23px; position: absolute; top: 50%; left: 50%; margin: -12px 0 0 -12px } @-webkit-keyframes load8 { 0% { -webkit-transform: rotate(0deg); transform: rotate(0deg); } 100% { -webkit-transform: rotate(360deg); transform: rotate(360deg); } } @keyframes load8 { 0% { -webkit-transform: rotate(0deg); transform: rotate(0deg); } 100% { -webkit-transform: rotate(360deg); transform: rotate(360deg); } } .spin.loading, .spin.loading:after { border-radius: 50%; width: 23px; height: 23px; } .spin.loading { font-size: 5px; text-indent: -9999em; border-top: 2.5em solid rgba(255, 255, 255, 0.2); border-right: 2.5em solid rgba(255, 255, 255, 0.2); border-bottom: 2.5em solid rgba(255, 255, 255, 0.2); border-left: 2.5em solid #ffffff; -webkit-transform: translateZ(0); -ms-transform: translateZ(0); transform: translateZ(0); -webkit-animation: load8 0.5s infinite linear; animation: load8 0.5s infinite linear; } .preloader { display: block } .preloader .spin.loading, .processing .spin.loading { display: block } .closed .preloader, .loaded .preloader { opacity: 0 } .payment-container { position: relative; -webkit-backface-visibility: hidden; -moz-backface-visibility: hidden; backface-visibility: hidden; width: 100%; height: 100%; top: 0; left: 0; overflow-y: scroll; background: rgba(0, 0, 0, 0.4) none repeat scroll 0 0; } </style> </head> <body> <div class="payment-container"> <div class="preloader spinner"> <span class="spin loading"></span> </div> </body> </html>';

        body.appendChild(iframeInit);
        body.appendChild(iframePayment);

        var documentInit = iframeInit.contentDocument
            ? iframeInit.contentDocument
            : (iframeInit.contentWindow ? iframeInit.contentWindow.document : iframeInit.document);

        documentInit.open();
        documentInit.write(contentInit);
        documentInit.close();

        setTimeout(function () {
            iframeInit.style.transform = "scale(1)";
            iframePayment.src = requestUrl;
        }, 0);
    }

    function init() {
        setTimeout(function () {
            iframePayment.style.transform = "scale(1)";
            iframePayment.style.display = "block";
            iframeInit.parentNode.removeChild(iframeInit);
        }, 10);
    }

    function close() {
        if (!!iframeInit && !!iframeInit.parentNode) {
            iframeInit.style.transform = "scale(0)";
            iframeInit.style.transition = "all .3s linear 0s";
            setTimeout(function () {
                iframeInit.parentNode.removeChild(iframeInit);
            }, 320);
        }
        if (!!iframePayment && !!iframePayment.parentNode) {
            iframePayment.style.transform = "scale(0)";
            iframePayment.style.transition = "all .3s linear 0s";
            setTimeout(function () {
                iframePayment.parentNode.removeChild(iframePayment);
            }, 320);
        }
    }

    return {
        init: init,
        open: open,
        close: close
    };
}

function PayBmMobileView(requestUrl) {
    var tabView = undefined;

    function isChromeiOS() {
        return /CriOS/.test(navigator.userAgent);
    }

    function windowName() {
        if (isChromeiOS()) {
            return "_blank";
        } else {
            return "paybm_tabview";
        }
    }

    function init() {
        // do nothing for mobile
    }

    function open() {
        tabView = window.open(requestUrl, windowName());
        tabView.focus();
    }

    function close() {
        tabView.close();
    }

    return {
        init: init,
        open: open,
        close: close
    };
}