import { translations } from './translations.js';

class LoveLockCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
  }

  setConfig(config) {
    this.config = config;
    if (this.hass) {
      this.updateCard();
    }
  }

  updateCard() {
    const config = this.config;

    const lang = this.hass && this.hass.selectedLanguage ? this.hass.selectedLanguage :
                 this.hass && this.hass.language ? this.hass.language : 'en';

    const currentTranslations = translations[lang] || translations['en'];

    const translate = (key) => currentTranslations[key] || translations['en'][key];

    if (!config || !config.cards || !Array.isArray(config.cards)) {
      throw new Error(translate("cardConfigIncorrect"));
    }

    if (config.popup == "password" && !config.password) {
      throw new Error(translate("passwordRequired"));
    }

    this.style.boxShadow =
      "var(--ha-card-box-shadow, 0 2px 2px 0 rgba(0, 0, 0, 0.14), 0 1px 5px 0 rgba(0, 0, 0, 0.12), 0 3px 1px -2px rgba(0, 0, 0, 0.2))";
    this.style.borderRadius = "var(--ha-card-border-radius, 2px)";
    this.style.background = "var(--paper-card-background-color)";
    this.style.display = "block";

    const root = this.shadowRoot;
    while (root.hasChildNodes()) {
      root.removeChild(root.lastChild);
    }

    const wrapper = document.createElement("div");
    wrapper.setAttribute("style", "position:relative");
    root.appendChild(wrapper);

    var password = '"' + btoa(config.password) + '"';

    const coverShow =
      '"position:absolute; top:0; left:0; width:100%; height: 100%; z-index:1000; transition: 1s opacity;"';
    const coverHide = '"display:none; transition: 1s opacity;"';

    var passwordScript = `
            var element = this;
            var pass = prompt("${translate("enterPassword")}");
            if (btoa(pass) !== ${password}) {
                alert("${translate("invalidPassword")}");
            } else {
                element.setAttribute("style", ${coverHide});
            }
            setTimeout(function(){
                element.setAttribute("style", ${coverShow});
            }, 10000)
            `;

    var confirmScript = `
            var element = this;
            var confirmpopup = confirm("${translate("confirmUnlock")}");
            if (confirmpopup == true) {
                this.setAttribute("style", ${coverHide});
            }
            setTimeout(function(){
                element.setAttribute("style", ${coverShow});
            }, 10000)
            `;

    var timeoutScript = `
            var element = this;
            element.style.opacity = '0';
            setTimeout(function(){
                element.setAttribute("style", ${coverHide});
            }, 1000)
            setTimeout(function(){
                element.style.opacity = '1';
                element.setAttribute("style", ${coverShow});
            }, 10000)
           `;

    const cover = document.createElement("div");
    cover.setAttribute(
      "style",
      "position:absolute; top:0; left:0; width:100%; height: 100%; z-index:1000; transition: 1s opacity;"
    );

    if (config.popup == "password") {
      cover.setAttribute("onclick", passwordScript);
    } else if (config.popup == "confirm") {
      cover.setAttribute("onclick", confirmScript);
    } else if (config.popup == "timeout") {
      cover.setAttribute("onclick", timeoutScript);
    }

    const lockicon = document.createElement("ha-icon");
    lockicon.setAttribute("icon", "mdi:lock-outline");
    lockicon.setAttribute("style", "position:absolute; top: 10px; right:7px;");
    cover.appendChild(lockicon);

    this._refCards = [];

    if (config.title) {
      const title = document.createElement("div");
      title.className = "header";
      title.style =
        "font-family: var(--paper-font-headline_-_font-family); -webkit-font-smoothing: var(--paper-font-headline_-_-webkit-font-smoothing); font-size: var(--paper-font-headline_-_font-size); font-weight: var(--paper-font-headline_-_font-weight); letter-spacing: var(--paper-font-headline_-_letter-spacing); line-height: var(--paper-font-headline_-_line-height);text-rendering: var(--paper-font-common-expensive-kerning_-_text-rendering);opacity: var(--dark-primary-opacity);padding: 24px 16px 0px 16px";
      const title_text = document.createTextNode(config.title);
      title.appendChild(title_text);
      wrapper.appendChild(title);
    }

    const _createThing = (tag, config) => {
      const element = document.createElement(tag);

      try {
        element.setConfig(config);
      } catch (err) {
        console.error(tag, err);
      }
      return element;
    };

    const _createError = (error, config) => {
      return _createThing("hui-error-card", {
        type: "error",
        error,
        config
      });
    };

    const _fireEvent = (ev, detail, entity = null) => {
      ev = new Event(ev, {
        bubbles: true,
        cancelable: false,
        composed: true
      });

      ev.detail = detail || {};

      if (entity) {
        entity.dispatchEvent(ev);
      } else {
        document
          .querySelector("home-assistant")
          .shadowRoot.querySelector("home-assistant-main")
          .shadowRoot.querySelector("app-drawer-layout partial-panel-resolver")
          .shadowRoot.querySelector("ha-panel-lovelace")
          .shadowRoot.querySelector("hui-root")
          .shadowRoot.querySelector("ha-app-layout #view")
          .firstElementChild.dispatchEvent(ev);
      }
    };

    config.cards.forEach(item => {
      let tag = item.type;

      if (tag.startsWith("divider")) {
        tag = `hui-divider-row`;
      } else if (tag.startsWith("custom:")) {
        tag = tag.substr("custom:".length);
      } else {
        tag = `hui-${tag}-card`;
      }

      if (customElements.get(tag)) {
        const element = _createThing(tag, item);

        wrapper.appendChild(element);

        if (config.popup) {
          wrapper.appendChild(cover);
        }

        this._refCards.push(element);
      } else {
        const element = _createError(
          `Custom element doesn't exist: ${tag}.`,
          item
        );
        element.style.display = "None";

        const time = setTimeout(() => {
          element.style.display = "";
        }, 2000);

        customElements.whenDefined(tag).then(() => {
          clearTimeout(time);
          _fireEvent("ll-rebuild", {}, element);
        });

        root.appendChild(element);
        this._refCards.push(element);
      }
    });
  }

  set hass(hass) {
    this._hass = hass;
    if (this.config) {
      this.updateCard();
    }
    if (this._refCards) {
      this._refCards.forEach(card => {
        card.hass = hass;
      });
    }
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    this._refCards.forEach(element => {
      let fn = () => {
        this._card(element);
      };

      if (element.updateComplete) {
        element.updateComplete.then(fn);
      } else {
        fn();
      }
    });
  }
    _card(element) {
      if (element.shadowRoot) {
        if (!element.shadowRoot.querySelector("ha-card")) {
          let searchEles = element.shadowRoot.getElementById("root");
          if (!searchEles) {
            searchEles = element.shadowRoot.getElementById("card");
          }
          if (!searchEles) return;
          searchEles = searchEles.childNodes;
  
          for (let i = 0; i < searchEles.length; i++) {
            if (searchEles[i].style !== undefined) {
              searchEles[i].style.margin = "0px";
            }
            this._card(searchEles[i]);
          }
        } else {
          element.shadowRoot.querySelector("ha-card").style.boxShadow = "none";
        }
      } else {
        if (
          typeof element.querySelector === "function" &&
          element.querySelector("ha-card")
        ) {
          element.querySelector("ha-card").style.boxShadow = "none";
        }
        let searchEles = element.childNodes;
        for (let i = 0; i < searchEles.length; i++) {
          if (searchEles[i] && searchEles[i].style) {
            searchEles[i].style.margin = "0px";
          }
          this._card(searchEles[i]);
        }
      }
    }
  
    getCardSize() {
      let totalSize = 0;
      this._refCards.forEach(element => {
        totalSize +=
          typeof element.getCardSize === "function" ? element.getCardSize() : 1;
      });
      return totalSize;
    }
  }
  
  customElements.define("love-lock-card", LoveLockCard);