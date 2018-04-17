import * as Hammer from "hammerjs";
import * as domStyle from "dojo/dom-style";
import { Utils } from "./Utils";

interface SwipeOptions {
    afterSwipeAction: {left: AfterSwipeAction, right: AfterSwipeAction};
    afterSwipeBackgroundName: {left: string, right: string };
    backgroundName: {left: string, right: string};
    callback: (element: HTMLElement, direction: Direction) => void;
    callbackDelay: { left: number, right: number };
    classPrefix: string;
    parentElement: HTMLElement;
    swipeDirection: Direction | "horizontal";
    transparentOnSwipe?: { left: boolean, right: boolean };
}

interface Elements { left: HTMLElement | undefined; right: HTMLElement | undefined; }

type Direction = "right" | "left";
type AfterSwipeAction = "reset" | "hide" | "none" | "back" | "button";

class HammerSwipe {
    private container: HTMLElement;
    private containerSize: number;
    private containerClass: string;
    private hammer: HammerManager;
    private options: SwipeOptions;
    private isSwiped = false;
    private isScrolling = false;
    private foreElement: HTMLElement;
    private backElement: Elements;
    private afterElement: Elements;
    private border: { left: number, right: number };
    private thresholdCompensation = 0;
    private thresholdAcceptSwipe: { left: number, right: number };
    // Internal settings
    readonly delayRemoveItem = 400; // Milliseconds
    readonly thresholdScroll = 60; // Pixels.
    readonly defaultThresholdAcceptSwipe = 30; // Percentage.
    readonly thresholdMove = 25; // Pixels
    readonly thresholdVelocity = 1.2; // Pixels per milliseconds
    readonly buttonClasses = [ "mx-button", "mx-link", "clickable" ];

    constructor(container: HTMLElement, options: SwipeOptions) {
        this.container = container;
        this.options = options;
        this.containerClass = this.container.className;

        this.setupElements(options);
        this.checkButtons("left");
        this.checkButtons("right");
        this.addHideTransitionEvent("left");
        this.addHideTransitionEvent("right");

        const direction = options.swipeDirection === "right" ? Hammer.DIRECTION_RIGHT
            : options.swipeDirection === "left" ? Hammer.DIRECTION_LEFT
            : options.swipeDirection === "horizontal" ? Hammer.DIRECTION_HORIZONTAL
            : Hammer.DIRECTION_NONE;

        this.hammer = new Hammer.Manager(this.container);
        this.hammer.add(new Hammer.Pan({
            direction,
            threshold: this.thresholdMove
        }));
        this.hammer.on("panstart", event => this.onPanStart(event));
        this.hammer.on("panmove", event => this.onPanMove(event));
        this.hammer.on("panend pancancel", event => this.onPanEnd(event));
    }

    destroy() {
        this.hammer.destroy();
    }

    private setupElements(options: SwipeOptions) {
        // Foreground is the mx-dataview-content
        this.foreElement = this.container.firstChild.firstChild as HTMLElement;
        Utils.addClass(this.foreElement, this.options.classPrefix + "-foreground");

        this.backElement = {
            left: this.findElement(options.backgroundName.left, "Swipe container left"),
            right: this.findElement(options.backgroundName.right, "Swipe container right")
        };
        this.afterElement = {
            left: this.findElement(options.afterSwipeBackgroundName.left, "Hide container left"),
            right: this.findElement(options.afterSwipeBackgroundName.right, "Hide container right")
        };
        this.setElementClasses();
    }

    private checkButtons(direction: Direction) {
        const backElement = this.backElement[direction];
        if (backElement && this.options.afterSwipeAction[direction] === "button") {
            const buttons = backElement.querySelectorAll("." + this.buttonClasses.join(", ."));
            if (buttons.length === 0) {
                throw new Error(`LVS no buttons or links found in the '${this.options.backgroundName[direction]}' ` +
                    `container. This is required when 'After swipe ${direction}' is set to 'Stick to button(s)'.`);
            }
        }
    }

    private findElement(name: string, displayName: string): HTMLElement | undefined {
        const element = name ? this.container.querySelector(`.mx-name-${name}`) as HTMLElement : undefined;
        if (element) {
            // Move additional elements to become a sibling of the the foreground
            this.foreElement.parentElement.appendChild(element);
        }
        if (name && !element) {
            throw new Error(`LVS no '${displayName}' found named ${name}. It should be placed inside the list view`);
        }
        return element;
    }

    private setElementClasses() {
        const prefix = this.options.classPrefix;
        Utils.addClass(this.backElement.left, prefix + "-background");
        Utils.addClass(this.backElement.right, prefix + "-background");
        if (this.backElement.left === this.backElement.right) {
            Utils.addClass(this.backElement.left, prefix + "-background-shared");
        } else {
            Utils.addClass(this.backElement.left, prefix + "-background-left");
            Utils.addClass(this.backElement.right, prefix + "-background-right");
        }

        Utils.addClass(this.afterElement.left, prefix + "-background-after");
        Utils.addClass(this.afterElement.right, prefix + "-background-after");
        if (this.afterElement.left === this.afterElement.right) {
            Utils.addClass(this.afterElement.left, prefix + "-background-after-shared");
        } else {
            Utils.addClass(this.afterElement.left, prefix + "-background-after-left");
            Utils.addClass(this.afterElement.right, prefix + "-background-after-right");
        }
    }

    private onPanStart(event: HammerInput) {
        if (event.pointerType === "mouse") return;
        if (this.isSwiped) {
            this.resetElements();
            return;
        }
        this.sizeCalculations();
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

        let percentage = (100 / this.containerSize) * (event.deltaX - this.thresholdCompensation);
        if (this.options.swipeDirection === "right" && percentage < 0) {
            percentage = 0;
        }
        if (this.options.swipeDirection === "left" && percentage > 0) {
            percentage = 0;
        }
        this.show(percentage, false);
    }

    private onPanEnd(event: HammerInput) {
        if (event.pointerType === "mouse") return;
        if (this.isScrolling) return;

        if (this.isSwiped) {
            this.isSwiped = false;
            return;
        }

        let percentage = (100 / this.containerSize) * (event.deltaX - this.thresholdCompensation);
        const direction = percentage < 0 ? "left" : "right";
        if (this.options.swipeDirection === "right" && percentage < 0) {
            percentage = 0;
        }
        if (this.options.swipeDirection === "left" && percentage > 0) {
            percentage = 0;
        }
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

    private sizeCalculations() {
        this.containerSize = this.container.offsetWidth;
        const containerOffset = this.container.getBoundingClientRect().left;
        this.border = {
            left: -this.containerSize + this.findButtonBorder("left") - containerOffset,
            right: this.findButtonBorder("right") - containerOffset
        };
        this.thresholdAcceptSwipe = {
            left: this.calculateThresholdAcceptSwipe("left"),
            right: this.calculateThresholdAcceptSwipe("right")
        };
    }

    private findButtonBorder(direction: Direction): number {
        Utils.removeClass(this.backElement[direction], "hidden");
        let borderEdge = 0;
        const backElement = this.backElement[direction];
        if (backElement && this.options.afterSwipeAction[direction] === "button") {
            const buttons = backElement.querySelectorAll("." + this.buttonClasses.join(", ."));
            for (let i = 0; i < buttons.length; i++) {
                const button = buttons[i] as HTMLElement;
                let position = button.getBoundingClientRect().left;
                if (direction === "left") {
                    borderEdge = borderEdge ? borderEdge > position ? position : borderEdge : position;
                } else {
                    position += button.offsetWidth;
                    borderEdge = borderEdge ? borderEdge < position ? position : borderEdge : position;
                }
            }
        }

        return borderEdge;
    }

    private calculateThresholdAcceptSwipe(direction: Direction): number {
        let thresholdAcceptSwipe = this.defaultThresholdAcceptSwipe;
        if (this.options.afterSwipeAction[direction] === "button") {
            thresholdAcceptSwipe = Math.abs(this.border[direction] / this.containerSize * 100);
        }

        return thresholdAcceptSwipe;
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

        const position = (this.containerSize / 100) * percentage;
        domStyle.set(this.foreElement, {
            opacity: direction && this.options.transparentOnSwipe[direction] ? 1 - Math.abs(percentage / 100) : 1,
            transform: "translate3d(" + position + "px, 0, 0)"
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
        let position = direction === "left" ? -this.containerSize : this.containerSize;
        if (this.options.afterSwipeAction[direction] === "button") {
            position = this.border[direction];
        }
        domStyle.set(this.foreElement, { transform: "translate3d(" + position + "px, 0, 0)" });
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
            setTimeout(() => {
                this.options.callback(this.container, direction);
            }, this.options.callbackDelay[direction]);
        } else if (this.options.afterSwipeAction[direction] === "reset") {
            setTimeout(() => {
                this.resetElements(false);
                this.isSwiped = false;
                this.options.callback(this.container, direction);
            }, this.options.callbackDelay[direction]);
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
            }, this.options.callbackDelay[direction]);
        } else if (this.options.afterSwipeAction[direction] === "none") {
            Utils.addClass(this.foreElement, "swiped-out");
            setTimeout(() => {
                this.options.callback(this.container, direction);
            }, this.options.callbackDelay[direction]);
        } else if (this.options.afterSwipeAction[direction] === "button") {
            setTimeout(() => {
                this.options.callback(this.container, direction);
            }, this.options.callbackDelay[direction]);
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
