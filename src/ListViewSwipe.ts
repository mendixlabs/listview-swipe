import * as dojoDeclare from "dojo/_base/declare";
import * as WidgetBase from "mxui/widget/_WidgetBase";

import * as registry from "dijit/registry";
import * as dojoAspect from "dojo/aspect";
import * as domClass from "dojo/dom-class";
import * as domConstruct from "dojo/dom-construct";

import * as Hammer from "hammerjs";
import { AfterSwipeAction, Direction, HammerSwipe, SwipeOptions } from "./HammerSwipe";

import "./ui/ListViewSwipe.css";

type OnSwipeAction = "disabled" | "doNothing" | "showPage" | "callMicroflow" | "callNanoflow";

interface ListView extends mxui.widget._WidgetBase {
    datasource: { path: string };
    _renderData: () => void;
    // Custom property to check single connected widget to a list view, preventing copy past mistakes
    connectListviewSwipeWidget: string;
}

interface Nanoflow {
    nanoflow: object[];
    paramsSpec: { Progress: string };
}

class ListViewSwipe extends WidgetBase {
    // Properties from Mendix modeler
    targetName: string;
    transparentOnSwipeLeft: boolean;
    transparentOnSwipeRight: boolean;
    itemEntity: string;
    actionTriggerDelayLeft: number;
    actionTriggerDelayRight: number;
    onSwipeActionLeft: OnSwipeAction;
    onSwipeActionRight: OnSwipeAction;
    onSwipeMicroflowLeft: string;
    onSwipeNanoflowLeft: Nanoflow;
    onSwipeMicroflowRight: string;
    onSwipeNanoflowRight: Nanoflow;
    onSwipePageLeft: string;
    onSwipePageRight: string;
    afterSwipeActionLeft: AfterSwipeAction;
    afterSwipeActionRight: AfterSwipeAction;
    backgroundNameLeft: string;
    backgroundNameRight: string;
    afterSwipeBackgroundNameLeft: string;
    afterSwipeBackgroundNameRight: string;

    private swipeClass: string;
    private targetWidget: ListView;
    private targetNode: HTMLElement;
    private hammers: HammerSwipe[];
    private onSwipePage: { left: string, right: string };
    private onSwipeMicroflow: { left: string, right: string };
    private onSwipeNanoflow: { left: Nanoflow, right: Nanoflow };
    private onSwipeAction: { left: OnSwipeAction, right: OnSwipeAction };
    private afterSwipeAction: { left: AfterSwipeAction, right: AfterSwipeAction };
    private backgroundName: { left: string, right: string };

    postCreate() {
        this.hammers = [];
        this.swipeClass = "widget-listview-swipe";
        this.onSwipePage = { left: this.onSwipePageLeft, right: this.onSwipePageRight };
        this.onSwipeMicroflow = { left: this.onSwipeMicroflowLeft, right: this.onSwipeMicroflowRight };
        this.onSwipeNanoflow = { left: this.onSwipeNanoflowLeft, right: this.onSwipeNanoflowRight };
        this.onSwipeAction = { left: this.onSwipeActionLeft, right: this.onSwipeActionRight };
        this.afterSwipeAction = { left: this.afterSwipeActionLeft, right: this.afterSwipeActionRight };
        this.backgroundName = { left: this.backgroundNameLeft, right: this.backgroundNameRight };
        this.targetNode = this.findTargetNode(this.targetName);
        if (this.validateConfig()) {
            this.targetWidget.connectListviewSwipeWidget = this.id;
            domClass.add(this.targetNode, this.swipeClass);
        } else {
            this.targetWidget = null;
        }
    }

    update(_contextObject: mendix.lib.MxObject, callback?: () => void) {
        if (this.targetWidget) {
            let direction: Direction | "horizontal" | undefined;
            if (this.onSwipeActionRight !== "disabled" && this.onSwipeActionLeft !== "disabled") {
                direction = "horizontal";
            } else if (this.onSwipeActionRight !== "disabled") {
                direction = "right";
            } else if (this.onSwipeActionLeft !== "disabled") {
                direction = "left";
            }

            if (direction) {
                const swipeOptions: SwipeOptions = {
                    afterSwipeAction: { left: this.afterSwipeActionLeft, right: this.afterSwipeActionRight },
                    afterSwipeBackgroundName: {
                        left: this.afterSwipeBackgroundNameLeft,
                        right: this.afterSwipeBackgroundNameRight
                    },
                    backgroundName: { left: this.backgroundNameLeft, right: this.backgroundNameRight },
                    callback: (element, swipeDirection) => this.handleSwipe(element, swipeDirection),
                    callbackDelay: { left: this.actionTriggerDelayLeft, right: this.actionTriggerDelayRight },
                    classPrefix: this.swipeClass,
                    parentElement: this.mxform.domNode,
                    swipeDirection: direction,
                    transparentOnSwipe: { left: this.transparentOnSwipeLeft, right: this.transparentOnSwipeRight }
                };
                // Note; this function is hooking into the Mendix private API, this is subject to change without notice!
                // Please do not re-use this. The only supported API is publicly documented at
                // https://apidocs.mendix.com/7/client/
                dojoAspect.after(this.targetWidget, "_renderData", () => {
                    try {
                        const listItems = this.targetNode.querySelectorAll(".mx-listview-item:not(.swipe-connected)");
                        Hammer.each(listItems, (container: HTMLElement) => {
                            container.classList.add("swipe-connected");
                            this.hammers.push(new HammerSwipe(container, swipeOptions));
                        }, this);
                    } catch (error) {
                        // Should be implemented with throw new ConfigError
                        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes
                        // #extending-built-ins-like-error-array-and-map-may-no-longer-work
                        const codeException = !error.message.startsWith("LVS ");
                        const message = codeException ? error.message : error.message.substring(4);
                        this.showError(message, codeException);
                    }
                });
            }
        }

        if (callback) callback();
    }

    uninitialize(): boolean {
        this.hammers.forEach(hammer => hammer.destroy());

        return true;
    }

    private findTargetNode(name: string): HTMLElement {
        let queryNode = this.domNode.parentNode as Element;
        let targetNode: HTMLElement | null = null;
        while (!targetNode) {
            targetNode = queryNode.querySelector(".mx-name-" + name) as HTMLElement;
            if (window.document.isEqualNode(queryNode)) { break; }
            queryNode = queryNode.parentNode as HTMLElement;
        }

        return targetNode;
    }

    private isDescendant(parent: HTMLElement, child: HTMLElement): boolean {
        let node = child.parentNode;
        while (node != null) {
            if (node === parent) {
                return true;
            }
            node = node.parentNode;
        }

        return false;
    }

    private validateConfig(): boolean {
        if (!this.targetNode) {
            this.showError(`unable to find 'Target list view' named '${this.targetName}'`);
            return false;
        }
        if (this.isDescendant(this.targetNode, this.domNode)) {
            this.showError("The widget should not be placed inside the list view, " +
                "move it directly below the list view, in the same context");
            return false;
        }
        this.targetWidget = registry.byNode(this.targetNode);
        if (!this.targetWidget) {
            this.showError(`Swipe widget view should be placed directly below the list view, in the same context`);
            return false;
        }
        if (this.targetWidget.declaredClass !== "mxui.widget.ListView") {
            this.showError(`'Target list view' name '${this.targetName}' is not of the type list view`);
            return false;
        }
        // Note; this function is hooking into the Mendix private API, this is subject to change!
        // Please do not re-use this. The only supported API is publicly documented at
        // https://apidocs.mendix.com/7/client/
        if (!this.targetWidget._renderData || !this.targetWidget.datasource || !this.targetWidget.datasource.path) {
            this.showError("this Mendix version is not compatible");
            window.logger.error("mxui.widget.ListView does not have a _renderData function or datasource.path");
            return false;
        }
        if (this.targetWidget.connectListviewSwipeWidget) {
            this.showError(`list view '${this.targetName}' can only have one swipe widget,
            it is already connected to ${this.targetWidget.connectListviewSwipeWidget}`);
            return false;
        }
        const segments = this.targetWidget.datasource.path.split("/");
        const listEntity = segments.length ? segments[segments.length - 1] : "";
        if (this.itemEntity && this.itemEntity !== listEntity) {
            this.showError(`'Item entity' ${this.itemEntity} does not match the list view entity ${listEntity}`);
            return false;
        }
        this.itemEntity = listEntity;
        if (this.onSwipeActionLeft === "disabled" && this.onSwipeActionRight === "disabled") {
            this.showError("no 'On swipe action' left or right selected");
            return false;
        }
        if (!this.validateActionConfig("left") || !this.validateActionConfig("right")) {
            return false;
        }

        return true;
    }

    private validateActionConfig(direction: Direction): boolean {
        if (this.onSwipeAction[direction] === "disabled") {
            return true;
        }
        if (this.onSwipeAction[direction] === "callMicroflow" && !this.onSwipeMicroflow[direction]) {
            this.showError(`no 'Microflow ${direction}' is selected`);
            return false;
        }
        if (this.onSwipeAction[direction] === "callNanoflow" && !this.onSwipeNanoflow[direction]) {
            this.showError(`no 'Nanoflow ${direction}' is selected`);
            return false;
        }
        if (this.onSwipeAction[direction] === "showPage" && !this.onSwipePage[direction]) {
            this.showError(`no 'Page ${direction}' is selected`);
            return false;
        }
        if (this.afterSwipeAction[direction] === "button" && !this.backgroundName[direction]) {
            this.showError(`no name for 'Swipe container ${direction}' provided. ` +
                `This is required when 'After swipe ${direction}' is set to 'Stick to button(s)'`);
            return false;
        }

        return true;
    }

    private showError(message: string, codeException = false) {
        // Place the message inside the list view, only when it is rendered, else the message is removed.
        const node = this.targetNode && this.targetNode.hasChildNodes() ? this.targetNode : this.domNode;
        const type = codeException ? "List view swipe code exception:" : "List view swipe configuration error:";
        domConstruct.place(`<div class='alert alert-danger'>${type}<br>- ${message}</div>`, node, "first");
        window.logger.error(this.id, `configuration error: ${message}`);
    }

    private handleSwipe(element: HTMLElement, direction: Direction) {
        const guid = registry.byNode(element).getGuid();
        const context = this.createContext(guid);
        this.handleAction(direction, context);
    }

    private handleAction(direction: Direction, context: mendix.lib.MxContext) {
        if (this.onSwipeAction[direction] === "callMicroflow" && this.onSwipeMicroflow[direction]) {
            window.mx.ui.action(this.onSwipeMicroflow[direction], {
                context,
                error: error =>
                    window.mx.ui.error(`An error occurred while executing microflow
                    ${this.onSwipeMicroflow[direction]}: ${error.message}`, true)
            });
        } else if (this.onSwipeAction[direction] === "callNanoflow" && this.onSwipeNanoflow[direction].nanoflow) {
            window.mx.data.callNanoflow({
                nanoflow: this.onSwipeNanoflow[direction],
                origin: this.mxform,
                context,
                error: error =>
                    window.mx.ui.error(`An error occurred while executing nanoflow
                    ${this.onSwipeNanoflow[direction]}: ${error.message}`, true)
            });
        } else if (this.onSwipeAction[direction] === "showPage" && this.onSwipePage[direction]) {
            window.mx.ui.openForm(this.onSwipePage[direction], {
                location: "content",
                context,
                error: error =>
                    window.mx.ui.error(`An error occurred while opening form
                    ${this.onSwipePage[direction]} : ${error.message}`)
            });
        }
    }

    private createContext(guid: string): mendix.lib.MxContext {
        const context = new mendix.lib.MxContext();
        context.setContext(this.itemEntity, guid);
        return context;
    }
}

// Declare widget prototype the Dojo way
// Thanks to https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/dojo/README.md
// tslint:disable : only-arrow-functions
dojoDeclare("ListViewSwipe.widget.ListViewSwipe", [ WidgetBase ], function(Source: any) {
    const result: any = {};
    for (const property in Source.prototype) {
        if (property !== "constructor" && Source.prototype.hasOwnProperty(property)) {
            result[property] = Source.prototype[property];
        }
    }
    return result;
}(ListViewSwipe));
