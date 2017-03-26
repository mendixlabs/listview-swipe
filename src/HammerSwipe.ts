import * as Hammer from "hammerjs";
import * as domStyle from "dojo/dom-style";
import { Utils } from "./Utils";

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
    private isSwiped = false;
    private isScrolling = false;
    private backElement: { right: HTMLElement | undefined, left: HTMLElement | undefined };
    private afterElement: { right: HTMLElement | undefined, left: HTMLElement | undefined };
    private border = { left: 0, right: 0 };
    private borderRight = 0;
    private borderLeft = 0;
    private swipeDirection: number;
    private thresholdCompensation = 0;
    private thresholdAcceptSwipe = { left: 30, right: 30 };
    // Internal settings
    readonly delayRemoveItem = 400; // Milliseconds
    readonly thresholdScroll = 60; // Pixels.
    //readonly thresholdAcceptSwipe = 30; // Percentage. //TODO stick to button
    readonly thresholdMove = 25; // Pixels
    readonly thresholdVelocity = 1.2; // Pixels per milliseconds

    constructor(container: HTMLElement, options: SwipeOptions) {
        this.container = container;
        this.options = options;
        this.containerClass = this.container.className;
        this.containerSize = this.container.offsetWidth;
        this.swipeDirection = (Hammer as any)[`DIRECTION_${options.swipeDirection.toUpperCase()}`];

        this.hammer = new Hammer.Manager(this.container);
        this.hammer.add(new Hammer.Pan({
            direction: this.swipeDirection,
            threshold: this.thresholdMove
        }));
        this.hammer.on("panstart", event => this.onPanStart(event));
        this.hammer.on("panmove", event => this.onPanMove(event));
        this.hammer.on("panend pancancel", event => this.onPanEnd(event));

        this.setupPanes(options);
        this.border.left = -this.containerSize + this.findButtonBorder("left");
        this.border.right = this.findButtonBorder("right");
        this.addHideTransitionEvent("left");
        this.addHideTransitionEvent("right");
    }

    destroy() {
        this.hammer.destroy();
    }

    private setupPanes(options: SwipeOptions) {
        // Foreground is the mx-dataview-content
        this.foreElement = this.container.firstChild.firstChild as HTMLElement;
        Utils.addClass(this.foreElement, "swipe-foreground");

        this.backElement = {
            left: this.findElement(options.backgroundName.left, "Swipe container left", "swipe-background"),
            right: this.findElement(options.backgroundName.right, "Swipe container right", "swipe-background")
        };
        this.afterElement = {
            left: this.findElement(options.afterSwipeBackgroundName.left, "Hide container left", "swipe-background-after"),
            right: this.findElement(options.afterSwipeBackgroundName.right, "Hide container right", "swipe-background-after")
        };
    }

    private findButtonBorder(direction: Direction): number {
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
        if (element) {
            if (addClass) {
                Utils.addClass(element, addClass);
            }
            // Move additional elements to become a sibling of the the foreground
            this.foreElement.parentElement.appendChild(element);
        }
        if (name && !element) {
            throw new Error(`no '${displayName}' found named ${name}`);
        }
        return element;
    }

    private onPanStart(event: HammerInput) {
        if (event.pointerType === "mouse") return;
        if (this.isSwiped) {
            this.resetElements();
            return;
        }
        this.isScrolling = false;
        this.thresholdCompensation = event.deltaX;
    }

    private onPanMove(event: HammerInput) {
        if (event.pointerType === "mouse") return;
        if (this.isSwiped) return;
        if (this.isScrolling) return;

        const isScrolling = Math.abs(event.deltaY) > this.thresholdScroll;
        if (isScrolling) {
            this.isScrolling = true;
            this.show(0, true);
            return;
        }

        const percentage = (100 / this.containerSize) * (event.deltaX - this.thresholdCompensation);
        this.show(percentage, false);
    }

    private onPanEnd(event: HammerInput) {
        if (event.pointerType === "mouse") return;
        if (this.isScrolling) return;

        if (this.isSwiped) {
            this.isSwiped = false;
            return;
        }

        const percentage = (100 / this.containerSize) * (event.deltaX - this.thresholdCompensation);
        const direction = percentage < 0 ? "left" : "right";
        if ((Math.abs(percentage) > this.thresholdAcceptSwipe[direction]
            || Math.abs(event.velocityX) > this.thresholdVelocity)
            && event.type === "panend") {
            this.swipeAnimation(direction);
            this.afterSwipeAnimation(direction);
            return;
        } else {
            this.show(0, true);
        }
    }

    private resetElements(animate = true) {
        Utils.removeClass(this.backElement.right, "hide");
        Utils.removeClass(this.backElement.left, "hide");
        Utils.removeClass(this.foreElement, "swiped-out");
        Utils.removeClass(this.container, "will-accept-swipe");
        Utils.addClass(this.afterElement.right, "hidden");
        Utils.addClass(this.afterElement.left, "hidden");
        this.show(0, animate);
    }

    private show(percentage = 0, animate?: boolean) {
        if (animate) {
            Utils.addClass(this.container, "animate");
        } else {
            Utils.removeClass(this.container, "animate");
        }

        const direction = percentage < 0 ? "left" : percentage > 0 ? "right" : undefined;
        if (direction && Math.abs(percentage) > this.thresholdAcceptSwipe[direction] ) {
            Utils.addClass(this.container, "will-accept-swipe");
        } else {
            Utils.removeClass(this.container, "will-accept-swipe");
        }
        if (direction) {
            this.updateBackground(direction);
            const oppositeDirection = direction === "left" ? "right" : "left";
            Utils.addClass(this.container, `swiping-${direction}`);
            Utils.removeClass(this.container, `swiping-${oppositeDirection}`);
        } else {
            Utils.removeClass(this.container, "swiping-right");
            Utils.removeClass(this.container, "swiping-left");
        }

        const pos = (this.containerSize / 100) * percentage;
        domStyle.set(this.foreElement, {
            opacity: this.options.transparentOnSwipe ? 1 - Math.abs(percentage / 100) : 1,
            transform: "translate3d(" + pos + "px, 0, 0)"
        });
    }

    private updateBackground(direction: Direction) {
        if (this.backElement.right !== this.backElement.left) {
            const oppositeDirection = direction === "left" ? "right" : "left";
            Utils.addClass(this.backElement[oppositeDirection], "hidden");
        }
        Utils.removeClass(this.backElement[direction], "hidden");
    }

    private swipeAnimation(direction: Direction) {
        Utils.addClass(this.container, "animate");
        let pos = direction === "left" ? -this.containerSize : this.containerSize;;
        if (this.options.afterSwipeAction[direction] === "button") {
            pos = this.border[direction];
        }
        domStyle.set(this.foreElement, { transform: "translate3d(" + pos + "px, 0, 0)" });
        if (this.options.afterSwipeAction[direction] === "none"
            || this.options.afterSwipeAction[direction] === "button") {
            this.addRestoreEvent(this.options.parentElement);
        }

        this.isSwiped = true;
    }

    private addRestoreEvent(element: HTMLElement) {
        const restore = (event: MouseEvent) => {
            if (!Utils.inElement(element, event.target as HTMLElement, [ "mx-button", "mx-link", "clickable" ])) {
                event.stopPropagation();
            }
            this.resetElements();
            this.isSwiped = false;
            element.removeEventListener("click", restore, true);
        };
        element.addEventListener("click", restore, true);
    }

    private afterSwipeAnimation(direction: Direction) {
        if (this.options.afterSwipeAction[direction] === "back") {
            this.resetElements(true);
            this.isSwiped = false;
            this.options.callback(this.container, direction);
        } else if (this.options.afterSwipeAction[direction] === "reset") {
            setTimeout(() => {
                this.resetElements(false);
                this.isSwiped = false;
                this.options.callback(this.container, direction);
            }, this.options.callbackDelay);
        } else if (this.options.afterSwipeAction[direction] === "hide") {
            const oppositeDirection = direction === "left" ? "right" : "left";
            if (this.afterElement.right !== this.afterElement.left) {
                Utils.addClass(this.afterElement[oppositeDirection], "hidden");
            }
            Utils.removeClass(this.afterElement[direction], "hidden");
            setTimeout(() => {
                Utils.addClass(this.container, "animate");
                domStyle.set(this.container, { height: 0 });

                setTimeout(() => {
                    Utils.addClass(this.container, "hide");
                    Utils.removeClass(this.container, "animate");
                    this.options.callback(this.container, direction);
                }, this.delayRemoveItem);
            }, this.options.callbackDelay);
        } else if (this.options.afterSwipeAction[direction] === "none") {
            Utils.addClass(this.foreElement, "swiped-out");
        }
    }

    private addHideTransitionEvent(direction: Direction) {
        if (this.options.afterSwipeAction[direction] === "hide") {
            this.foreElement.addEventListener("transitionend", () => {
                if (this.isSwiped) {
                    domStyle.set(this.container, {
                        height: this.container.offsetHeight + "px"
                    });
                    Utils.addClass(this.backElement[direction], "hide");
                }
            });
        }
    }
}

export { HammerSwipe, Direction, AfterSwipeAction, SwipeOptions };
