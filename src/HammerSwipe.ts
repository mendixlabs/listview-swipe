import * as Hammer from "hammerjs";
import * as domStyle from "dojo/dom-style";

interface SwipeOptions {
    afterSwipeAction: {left: AfterSwipeAction, right: AfterSwipeAction};
    afterSwipeBackgroundName: {left: string, right: string };
    backgroundName: {left: string, right: string};
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
    private backElement: { right: HTMLElement | undefined, left: HTMLElement | undefined };
    private afterElement: { right: HTMLElement | undefined, left: HTMLElement | undefined };
    private border = { left: 0, right: 0 };
    private borderRight = 0;
    private borderLeft = 0;
    private swipeDirection: number;
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
        this.swipeDirection = (Hammer as any)[`DIRECTION_${options.swipeDirection.toUpperCase()}`];

        this.hammer = new Hammer.Manager(this.container);
        this.hammer.add(new Hammer.Pan({
            direction: this.swipeDirection,
            threshold: this.moveThreshold
        }));
        this.hammer.on("panstart panmove panend pancancel", event => this.onPan(event));

        this.setupPanes(options);
        this.border.left = -this.containerSize + this.findButtonsPositions("left");
        this.border.right = this.findButtonsPositions("right");
        this.registerExtraEvents("left");
        this.registerExtraEvents("right");
    }

    destroy() {
        this.hammer.destroy();
    }

    private setupPanes(options: SwipeOptions) {
        // Foreground is the mx-dataview-content
        this.foreElement = this.container.firstChild.firstChild as HTMLElement;
        this.addClass(this.foreElement, "swipe-foreground");

        this.backElement = {
            left: this.findElement(options.backgroundName.left, "Swipe container left", "swipe-background"),
            right: this.findElement(options.backgroundName.right, "Swipe container right", "swipe-background")
        };
        this.afterElement = {
            left: this.findElement(options.afterSwipeBackgroundName.left, "Hide container left", "swipe-background-after"),
            right: this.findElement(options.afterSwipeBackgroundName.right, "Hide container right", "swipe-background-after")
        };
    }

    private findButtonsPositions(direction: Direction): number {
        let border = 0;
        const backElement = this.backElement[direction];
        if (backElement && this.options.afterSwipeAction[direction] === "button") {
            const buttons = backElement.querySelectorAll(".mx-button, .mx-link, .clickable");
            for (let i = 0; i < buttons.length; i++) {
                const el = buttons[i] as HTMLElement;
                let position = el.getBoundingClientRect().left;
                if (direction === "left") {
                    border = border ? border > position ? position : border : position;
                } else {
                    position += el.offsetWidth;
                    border = border ? border < position ? position : border : position;
                }
            }
            if (buttons.length === 0) {
                throw new Error(`no buttons or links found in the '${this.options.backgroundName[direction]}' ` +
                    `container. This is required when after swipe ${direction} is set to Stick to button.`);
            }
        }
        return border;
    }

    private findElement(name: string, displayName: string, addClass?: string): HTMLElement | undefined {
        const element = name ? this.container.querySelector(`.mx-name-${name}`) as HTMLElement : undefined;
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
        this.removeClass(this.backElement.right, "hide");
        this.removeClass(this.backElement.left, "hide");
        this.removeClass(this.foreElement, "swiped-out");
        this.removeClass(this.container, "will-accept-swipe");
        this.show(0, undefined, animate);
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
        if (this.swipeDirection === Hammer.DIRECTION_RIGHT && currentPercentage < 0) {
            currentPercentage = 0;
        }
        if (this.swipeDirection === Hammer.DIRECTION_LEFT && currentPercentage > 0) {
            currentPercentage = 0;
        }
        let animate = false;
        const isScrolling = Math.abs(event.deltaY) > this.thresholdScrolling;
        if (isScrolling) {
            this.isScrolling = true;
            this.show(0, undefined, true);
            return;
        }
        if (Math.abs(currentPercentage) > this.swipeAcceptThreshold ) {
            this.addClass(this.container, "will-accept-swipe");
        } else {
            this.removeClass(this.container, "will-accept-swipe");
        }
        const direction: Direction | undefined = currentPercentage < 0 ? "left" : currentPercentage > 0 ? "right" : undefined;
        if ((event.type === "panend" || event.type === "pancancel") && direction) {
            if ((Math.abs(currentPercentage) > this.swipeAcceptThreshold
                || Math.abs(event.velocityX) > this.flickVelocity)
                && event.type === "panend") {
                this.swipeAnimation(direction);
                this.afterSwipeAnimation(direction);
                return;
            }
            currentPercentage = 0;
            animate = true;
        }
        this.show(currentPercentage, direction, animate);
    }

    private show(currentPercentage = 0, direction: Direction | undefined, animate?: boolean) {
        const hundredPercent = 100;
        const pos = (this.containerSize / hundredPercent) * currentPercentage;

        this.updateBackground(direction);

        if (animate) {
            this.addClass(this.container, "animate");
        } else {
            this.removeClass(this.container, "animate");
            this.addClass(this.container, pos < 0 ? "swiping-left" : "swiping-right");
        }

        if (direction) {
            const oppositeDirection = direction === "left" ? "right" : "left";
            this.addClass(this.container, `swiping-${direction}`);
            this.removeClass(this.container, `swiping-${oppositeDirection}`);
        } else {
            this.removeClass(this.container, "swiping-right");
            this.removeClass(this.container, "swiping-left");
        }

        domStyle.set(this.foreElement, {
            opacity: this.options.transparentOnSwipe ? 1 - Math.abs(currentPercentage / hundredPercent) : 1,
            transform: "translate3d(" + pos + "px, 0, 0)"
        });
    }

    private updateBackground(direction: Direction | undefined) {
        this.addClass(this.afterElement.right, "hidden");
        this.addClass(this.afterElement.left, "hidden");
        if (direction) {
            const oppositeDirection = direction === "left" ? "right" : "left";
            if (this.backElement.right !== this.backElement.left) {
                this.addClass(this.backElement[oppositeDirection], "hidden");
            }
            this.removeClass(this.backElement[direction], "hidden");
        }
    }

    private addClass(element: HTMLElement | undefined, className: string) {
        if (element) {
            element.classList.add(className);
        }
    }

    private removeClass(element: HTMLElement | undefined, className: string) {
        if (element && element.classList) {
            element.classList.remove(className);
        }
    }

    private swipeAnimation(direction: Direction) {
        let pos;
        if (this.options.afterSwipeAction[direction] === "button") {
            pos = this.border[direction];
        } else {
            pos = direction === "left" ? -this.containerSize : this.containerSize;
        }
        this.addClass(this.container, "animate");
        domStyle.set(this.foreElement, { transform: "translate3d(" + pos + "px, 0, 0)" });
        this.swipedOut = true;
        if (this.options.afterSwipeAction[direction] === "none"
            || this.options.afterSwipeAction[direction] === "button") {
            this.addRestoreEvent(this.options.parentElement);
        }
    }

    private addRestoreEvent(element: HTMLElement) {
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

    private afterSwipeAnimation(direction: Direction) {
        if (this.options.afterSwipeAction[direction] === "back") {
            this.resetElements(true);
            this.swipedOut = false;
            this.options.callback(this.container, direction);
        } else if (this.options.afterSwipeAction[direction] === "reset") {
            setTimeout(() => {
                this.resetElements(false);
                this.swipedOut = false;
                this.options.callback(this.container, direction);
            }, this.options.callbackDelay);
        } else if (this.options.afterSwipeAction[direction] === "hide") {
            const oppositeDirection = direction === "left" ? "right" : "left";
            if (this.afterElement.right !== this.afterElement.left) {
                this.addClass(this.afterElement[oppositeDirection], "hidden");
            }
            this.removeClass(this.afterElement[direction], "hidden");
            setTimeout(() => {
                this.addClass(this.container, "animate");
                domStyle.set(this.container, { height: 0 });

                setTimeout(() => {
                    this.addClass(this.container, "hide");
                    this.removeClass(this.container, "animate");
                    this.options.callback(this.container, direction);
                }, this.removeItemDelay);
            }, this.options.callbackDelay);
        } else if (this.options.afterSwipeAction[direction] === "none") {
            this.addClass(this.foreElement, "swiped-out");
        }
    }

    private registerExtraEvents(direction: Direction) {
        if (this.options.afterSwipeAction[direction] === "hide") {
            this.foreElement.addEventListener("transitionend", () => {
                if (this.swipedOut) {
                    domStyle.set(this.container, {
                        height: this.container.offsetHeight + "px"
                    });
                    this.addClass(this.backElement[direction], "hide");
                }
            });
        }
    }
}

export { HammerSwipe, Direction, AfterSwipeAction, SwipeOptions };
