import * as Hammer from "hammerjs";
import * as domStyle from "dojo/dom-style";

interface SwipeOptions {
    afterSwipeActionLeft: AfterSwipeAction;
    afterSwipeActionRight: AfterSwipeAction;
    afterSwipeBackgroundNameLeft?: string;
    afterSwipeBackgroundNameRight?: string;
    backgroundNameLeft: string;
    backgroundNameRight: string;
    callback: (element: HTMLElement, direction: Direction) => void;
    callbackDelay: number;
    foregroundName: string;
    parentElement: HTMLElement;
    swipeDirection: Direction | "horizontal";
    transparentOnSwipe?: boolean;
}

interface AfterSwipeOptions {
    elementName: string;
    action: AfterSwipeAction;
}

type Direction = "right" | "left";
type AfterSwipeAction = "reset" | "hide" | "none" | "back" | "button";

class HammerSwipe {
    private container: HTMLElement;
    private foreElement: HTMLElement;
    private containerSize: number;
    private containerClass: string;
    private hammer: HammerManager;
    private options: SwipeOptions;
    private swipedOut = false;
    private isScrolling = false;
    private backElementRight: HTMLElement;
    private backElementLeft: HTMLElement;
    private afterElementRight: HTMLElement;
    private afterElementLeft: HTMLElement;
    private borderRight = 0;
    private borderLeft = 0;
    private direction: number;
    private thresholdCompensation = 0;
    // Internal settings
    readonly thresholdScrolling = 60; // Pixels.
    readonly swipeAcceptThreshold = 30; // Percentage.
    readonly removeItemDelay = 400; // Milliseconds
    readonly moveThreshold = 25; // Pixels
    readonly flickVelocity = 1.2; // Pixels per milliseconds

    constructor(container: HTMLElement, options: SwipeOptions) {
        this.container = container;
        this.options = options;
        this.containerClass = this.container.className;
        this.containerSize = this.container.offsetWidth;
        this.direction = (Hammer as any)[`DIRECTION_${options.swipeDirection.toUpperCase()}`];

        this.hammer = new Hammer.Manager(this.container);
        this.hammer.add(new Hammer.Pan({
            direction: this.direction,
            threshold: this.moveThreshold
        }));
        this.hammer.on("panstart panmove panend pancancel", event => this.onPan(event));

        this.setupPanes(options);
        this.registerExtraEvents();
    }

    destroy() {
        this.hammer.destroy();
    }

    private setupPanes(options: SwipeOptions) {
        // Foreground is the mx-dataview-content
        this.foreElement = this.container.firstChild.firstChild as HTMLElement;
        this.addClass(this.foreElement, "swipe-foreground");

        this.backElementRight = this.findElement(options.backgroundNameRight, "Swipe container right", "swipe-background");
        this.backElementLeft = this.findElement(options.backgroundNameLeft, "Swipe container left", "swipe-background");
        this.afterElementRight = this.findElement(options.afterSwipeBackgroundNameRight, "Hide container right", "swipe-background-after");
        this.afterElementLeft = this.findElement(options.afterSwipeBackgroundNameLeft, "Hide container left", "swipe-background-after");

        this.FindButtonsPositions();
    }

    private FindButtonsPositions() {
        if (this.backElementRight && this.options.afterSwipeActionRight === "button") {
            const buttonsRight = this.backElementRight.querySelectorAll(".mx-button, .mx-link, .clickable");
            for (let i = 0; i < buttonsRight.length; i++) {
                const el = buttonsRight[i] as HTMLElement;
                const right = el.getBoundingClientRect().left + el.offsetWidth;
                this.borderRight = this.borderRight ? this.borderRight < right ? right : this.borderRight : right;
            }
            if (buttonsRight.length === 0) {
                throw new Error(`no buttons or links found in the '${this.options.backgroundNameRight}' container. ` +
                    `This is required when after swipe right is set to Stick to button.`);
            }
        }
        if (this.backElementLeft && this.options.afterSwipeActionLeft === "button") {
            const buttonsLeft = this.backElementLeft.querySelectorAll(".mx-button, .mx-link, .clickable");
            for (let i = 0; i < buttonsLeft.length; i++) {
                const el = buttonsLeft[i] as HTMLElement;
                const left = el.getBoundingClientRect().left;
                this.borderLeft = this.borderLeft ? this.borderLeft > left ? left : this.borderLeft : left;
            }
            if (buttonsLeft.length === 0) {
                throw new Error(`no buttons or links found in the '${this.options.backgroundNameLeft}' container. ` +
                    `This is required when after swipe left is set to Stick to button.`);
            }
        }
    }

    private findElement(name: string, displayName: string, addClass?: string): HTMLElement | null {
        const element = name ? this.container.querySelector(`.mx-name-${name}`) as HTMLElement : null;
        if (name && !element) {
            throw new Error(`no '${displayName}' found named ${name}`);
        }
        if (element && addClass) {
            this.addClass(element, addClass);
        }
        if (element) {
            // Move additional elements to become a sibling of the the foreground
            this.foreElement.parentElement.appendChild(element);
        }
        return element;
    }

    private resetElements(animate = true) {
        this.removeClass(this.backElementRight, "hide");
        this.removeClass(this.backElementLeft, "hide");
        this.removeClass(this.foreElement, "swiped-out");
        this.removeClass(this.container, "will-accept-swipe");
        this.show(0, animate);
    }

    private onPan(event: HammerInput) {
        if (event.pointerType === "mouse") return;
        if (this.swipedOut && event.type === "panstart") {
            this.resetElements();
            return;
        }
        if (this.swipedOut && event.type === "panend") {
            this.swipedOut = false;
            return;
        }
        if (this.swipedOut) {
            return;
        }

        if (event.type === "panstart") {
            this.isScrolling = false;
            this.thresholdCompensation = event.deltaX;
        }
        if (this.isScrolling) {
            return;
        }
        const maximumPercentage = 100;
        let currentPercentage = (maximumPercentage / this.containerSize) * (event.deltaX - this.thresholdCompensation);
        if (this.direction === Hammer.DIRECTION_RIGHT && currentPercentage < 0) {
            currentPercentage = 0;
        }
        if (this.direction === Hammer.DIRECTION_LEFT && currentPercentage > 0) {
            currentPercentage = 0;
        }
        let animate = false;
        const isScrolling = Math.abs(event.deltaY) > this.thresholdScrolling;
        if (isScrolling) {
            this.isScrolling = true;
            this.show(0, true);
            return;
        }
        if (Math.abs(currentPercentage) > this.swipeAcceptThreshold ) {
            this.addClass(this.container, "will-accept-swipe");
        } else {
            this.removeClass(this.container, "will-accept-swipe");
        }
        if (event.type === "panend" || event.type === "pancancel") {
            if ((Math.abs(currentPercentage) > this.swipeAcceptThreshold || Math.abs(event.velocityX) > this.flickVelocity)
                && event.type === "panend") {
                const direction: Direction = currentPercentage < 0 ? "left" : "right";
                this.out(direction);
                return;
            }
            currentPercentage = 0;
            animate = true;
        }
        this.show(currentPercentage, animate);
    }

    private show(currentPercentage = 0, animate?: boolean) {
        const hundredPercent = 100;
        const pos = (this.containerSize / hundredPercent) * currentPercentage;

        this.updateBackground(pos);

        if (animate) {
            this.addClass(this.container, "animate");
        } else {
            this.removeClass(this.container, "animate");
            this.addClass(this.container, pos < 0 ? "swiping-left" : "swiping-right");
        }

        if (currentPercentage !== 0) {
            this.addClass(this.container, `swiping-${pos < 0 ? "left" : "right"}`);
            this.removeClass(this.container, `swiping-${pos < 0 ? "right" : "left"}`);
        } else {
            this.removeClass(this.container, "swiping-right");
            this.removeClass(this.container, "swiping-left");
        }

        domStyle.set(this.foreElement, {
            opacity: this.options.transparentOnSwipe ? 1 - Math.abs(currentPercentage / hundredPercent) : 1,
            transform: "translate3d(" + pos + "px, 0, 0)"
        });
    }

    private updateBackground(pos: number) {
        this.addClass(this.afterElementRight, "hidden");
        this.addClass(this.afterElementLeft, "hidden");
        if (pos < 0) {
            if (this.backElementRight !== this.backElementLeft) {
                this.addClass(this.backElementRight, "hidden");
            }
            this.removeClass(this.backElementLeft, "hidden");
        } else if (pos > 0) {
            this.removeClass(this.backElementRight, "hidden");
            if (this.backElementRight !== this.backElementLeft) {
                this.addClass(this.backElementLeft, "hidden");
            }
        }
    }

    private addClass(element: HTMLElement, className: string) {
        if (element) {
            element.classList.add(className);
        }
    }

    private removeClass(element: HTMLElement, className: string) {
        if (element && element.classList) {
            element.classList.remove(className);
        }
    }

    private out(direction: Direction) {
        let pos;
        if (this.options.afterSwipeActionLeft === "button" && direction === "left") {
            pos = -this.containerSize + this.borderLeft;
            this.addRestoreEvent(this.options.parentElement);
        } else if (this.options.afterSwipeActionRight === "button" && direction === "right") {
            pos = this.borderRight;
            this.addRestoreEvent(this.options.parentElement);
        } else {
            pos = direction === "left" ? -this.containerSize : this.containerSize;
        }
        this.addClass(this.container, "animate");
        domStyle.set(this.foreElement, { transform: "translate3d(" + pos + "px, 0, 0)" });
        this.swipedOut = true;
        if (this.options.afterSwipeActionLeft === "none" && direction === "left") {
            this.addRestoreEvent(this.options.parentElement);
        }
        if (this.options.afterSwipeActionRight === "none" && direction === "right") {
            this.addRestoreEvent(this.options.parentElement);
        }
        this.afterSwipe(direction);
    }

    private addRestoreEvent(element: HTMLElement) {
        if (element) {
            const restore = (event: MouseEvent) => {
                if (!this.inElement(element, event.target as HTMLElement, [ "mx-button", "mx-link", "clickable" ])) {
                    event.stopPropagation();
                }
                this.resetElements();
                this.swipedOut = false;
                element.removeEventListener("click", restore, true);
            };
            element.addEventListener("click", restore, true);
        }
    }

    private inElement(elementContainer: HTMLElement, element: HTMLElement, classNames: string[]): boolean {
        let hasClass = false;
        classNames.forEach(className => hasClass = hasClass || element.classList.contains(className));
        if (hasClass) {
            return true;
        } else {
            if (elementContainer !== element) {
                return this.inElement(elementContainer, element.parentNode as HTMLElement, classNames);
            } else {
                return false;
            }
        }
    }

    private afterSwipe(direction: Direction) {
        if (this.options.afterSwipeActionRight === "back" && direction === "right" ||
            this.options.afterSwipeActionLeft === "back" && direction === "left") {
            this.resetElements(true);
            this.swipedOut = false;
            this.options.callback(this.container, direction);
        } else if (this.options.afterSwipeActionRight === "reset" && direction === "right" ||
            this.options.afterSwipeActionLeft === "reset" && direction === "left") {
            setTimeout(() => {
                this.resetElements(false);
                this.swipedOut = false;
                this.options.callback(this.container, direction);
            }, this.options.callbackDelay);
        } else if (this.options.afterSwipeActionRight === "hide" && direction === "right" ||
            this.options.afterSwipeActionLeft === "hide" && direction === "left") {
            if (direction === "left") {
                if (this.afterElementRight !== this.afterElementLeft) {
                    this.addClass(this.afterElementRight, "hidden");
                }
                this.removeClass(this.afterElementLeft, "hidden");
            } else {
                this.removeClass(this.afterElementRight, "hidden");
                if (this.afterElementRight !== this.afterElementLeft) {
                    this.addClass(this.afterElementLeft, "hidden");
                }
            }
            setTimeout(() => {
                this.addClass(this.container, "animate");
                domStyle.set(this.container, { height: 0 });

                setTimeout(() => {
                    this.addClass(this.container, "hide");
                    this.removeClass(this.container, "animate");
                    this.options.callback(this.container, direction);
                }, this.removeItemDelay);
            }, this.options.callbackDelay);
        } else if (this.options.afterSwipeActionRight === "none" && direction === "right" ||
            this.options.afterSwipeActionLeft === "none" && direction === "left") {
            this.addClass(this.foreElement, "swiped-out");
        }
    }

    private registerExtraEvents() {
        if (this.options.afterSwipeActionRight === "hide") {
            this.foreElement.addEventListener("transitionend", () => {
                if (this.swipedOut) {
                    domStyle.set(this.container, {
                        height: this.container.offsetHeight + "px"
                    });
                    if (this.backElementRight) {
                        this.addClass(this.backElementRight, "hide");
                    }
                }
            });
        }
        if (this.options.afterSwipeActionLeft === "hide") {
            this.foreElement.addEventListener("transitionend", () => {
                if (this.swipedOut) {
                    domStyle.set(this.container, {
                        height: this.container.offsetHeight + "px"
                    });
                    if (this.backElementLeft) {
                        this.addClass(this.backElementLeft, "hide");
                    }
                }
            });
        }
    }
}

export { HammerSwipe, Direction, AfterSwipeAction, SwipeOptions };
