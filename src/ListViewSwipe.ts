import * as dojoDeclare from "dojo/_base/declare";
import * as WidgetBase from "mxui/widget/_WidgetBase";

import * as registry from "dijit/registry";
import * as dojoAspect from "dojo/aspect";
import * as domClass from "dojo/dom-class";
import * as domConstruct from "dojo/dom-construct";

import * as Hammer from "hammerjs";
import { AfterSwipeAction, Direction, HammerSwipe, SwipeOptions } from "./HammerSwipe";

import "./ui/ListViewSwipe.css";

type OnSwipeAction = "disabled" | "doNothing" | "showPage" | "callMicroflow";

interface ListView extends mxui.widget._WidgetBase {
    datasource: { path: string };
    _renderData: () => void;
    // Custom property to check single connected widget to a listview, preventing copy past mistakes
    connectListviewSwipeWidget: string;
}

class ListViewSwipe extends WidgetBase {
    // Properties from Mendix modeler
    targetName: string;
    foregroundName: string;
    transparentOnSwipe: boolean;
    itemEntity: string;
    actionTriggerDelay: number;
    onSwipeActionRight: OnSwipeAction;
    onSwipeActionLeft: OnSwipeAction;
    onSwipeMicroflowLeft: string;
    onSwipeMicroflowRight: string;
    onSwipePageLeft: string;
    onSwipePageRight: string;
    afterSwipeActionRight: AfterSwipeAction;
    afterSwipeActionLeft: AfterSwipeAction;
    backgroundNameRight: string;
    backgroundNameLeft: string;
    afterSwipeBackgroundNameRight: string;
    afterSwipeBackgroundNameLeft: string;

    private swipeClass: string;
    private targetWidget: ListView;
    private targetNode: HTMLElement;
    private contextObject: mendix.lib.MxObject;
    private hammers: HammerSwipe[];

    postCreate() {
        this.hammers = [];
        this.swipeClass = "widget-listview-swipe";
        this.targetNode = this.findTargetNode(this.targetName);
        if (this.validateConfig()) {
            this.targetWidget = registry.byNode(this.targetNode);
            domClass.add(this.targetNode, this.swipeClass);
        }
    }

    update(contextObject: mendix.lib.MxObject, callback?: () => void) {
        if (this.targetWidget) {
            this.contextObject = contextObject;
            let direction: Direction | "horizontal";
            if (this.onSwipeActionRight !== "disabled" && this.onSwipeActionLeft !== "disabled") {
                direction = "horizontal";
            } else if (this.onSwipeActionRight !== "disabled") {
                direction = "right";
            } else if (this.onSwipeActionLeft !== "disabled") {
                direction = "left";
            }

            if (direction) {
                const swipeOptions: SwipeOptions = {
                    afterSwipeActionLeft: this.afterSwipeActionLeft,
                    afterSwipeActionRight: this.afterSwipeActionRight,
                    afterSwipeBackgroundNameLeft: this.afterSwipeBackgroundNameLeft,
                    afterSwipeBackgroundNameRight: this.afterSwipeBackgroundNameRight,
                    backgroundNameLeft: this.backgroundNameLeft,
                    backgroundNameRight: this.backgroundNameRight,
                    callback: (element, swipeDirection) => this.handleSwipe(element, swipeDirection),
                    callbackDelay: this.actionTriggerDelay,
                    foregroundName: this.foregroundName,
                    parentElement: this.mxform.domNode,
                    swipeDirection: direction,
                    transparentOnSwipe: this.transparentOnSwipe
                };

                dojoAspect.after(this.targetWidget, "_renderData", () => {
                    try {
                        Hammer.each(this.targetNode.querySelectorAll(".mx-listview-item:not(.swipe-connected)"), (container: HTMLElement) => {
                            container.classList.add("swipe-connected");
                            this.hammers.push(new HammerSwipe(container, swipeOptions));
                        }, this);
                    } catch (error) {
                        this.showConfigError(error.message);
                    }
                });
            }
        }

        if (callback) callback();
    }

    uninitialize(): boolean {
        this.hammers.forEach((hammer) => {
            hammer.destroy();
        });
        return true;
    }

    private findTargetNode(name: string): HTMLElement {
        let queryNode = this.domNode.parentNode as Element;
        let targetNode: HTMLElement;
        while (!targetNode) {
            targetNode = queryNode.querySelector(".mx-name-" + name) as HTMLElement;
            if (window.document.isEqualNode(queryNode)) { break; }
            queryNode = queryNode.parentNode as HTMLElement;
        }
        return targetNode;
    }

    private isDescendant(parent: HTMLElement, child: HTMLElement) {
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
            this.showConfigError(`unable to find 'Target listview' named '${this.targetName}'`);
            return false;
        }
        if (this.isDescendant(this.targetNode, this.domNode)) {
            this.showConfigError("The widget should not be placed inside the list view, move it just below");
            return false;
        }
        this.targetWidget = registry.byNode(this.targetNode);
        if (!this.targetWidget) {
            this.showConfigError(`list view should be placed below the list view, in the same context`);
            return false;
        }
        if (this.targetWidget.declaredClass !== "mxui.widget.ListView") {
            this.showConfigError(`'Target listview' name '${this.targetName}' is not of the type listview`);
            return false;
        }
        if (this.targetWidget._renderData === undefined
            || this.targetWidget.datasource === undefined
            || this.targetWidget.datasource.path === undefined) {
                this.showConfigError("this Mendix version is not compatible");
                window.logger.error("mxui.widget.ListView does not have a _renderData function or datasource.path");
                return false;
        }
        if (this.targetWidget.connectListviewSwipeWidget) {
            this.showConfigError(`list view '${this.targetName}' can only have on swipe widget,
            it is already connected to ${this.targetWidget.connectListviewSwipeWidget}`);
            return false;
        }
        this.targetWidget.connectListviewSwipeWidget = this.id;

        const segments = this.targetWidget.datasource.path.split("/");
        const listEntity = segments.length ? segments[segments.length - 1] : "";
        if (this.itemEntity && this.itemEntity !== listEntity) {
            this.showConfigError(`'Item entity' ${this.itemEntity} does not 
            match the listview entity ${listEntity}`);
            return false;
        }
        this.itemEntity = listEntity;
        if (this.onSwipeActionRight === "callMicroflow" && !this.onSwipeMicroflowRight) {
            this.showConfigError("no 'Microflow right' is selected");
            return false;
        }
        if (this.onSwipeActionLeft === "callMicroflow" && !this.onSwipeMicroflowLeft) {
            this.showConfigError("no 'Microflow left' is selected");
            return false;
        }
        if (this.onSwipeActionRight === "showPage" && !this.onSwipePageRight) {
            this.showConfigError("no 'Open page right' is selected");
            return false;
        }
        if (this.onSwipeActionLeft === "showPage" && !this.onSwipePageLeft) {
            this.showConfigError("no 'Open page left' is selected");
            return false;
        }
        if (this.onSwipeActionLeft === "disabled" && this.onSwipeActionRight === "disabled") {
            this.showConfigError("no 'On swipe' action left or right selected");
            return false;
        }
        if (this.afterSwipeActionRight === "button" && this.backgroundNameRight === "") {
            this.showConfigError("no 'Swipe container right' name provided." +
                "This is required when 'After swipe right' is set to stick to button");
            return false;
        }
        if (this.afterSwipeActionLeft === "button" && this.backgroundNameLeft === "") {
            this.showConfigError("no 'Swipe container left' name provided." +
                "This is required when 'After swipe left' is set to Stick to button");
            return false;
        }
        return true;
    }

    private showConfigError(message: string) {
        // Place the message inside the list view, only when it is rendered, else the message is removed.
        const node = this.targetNode && this.targetNode.hasChildNodes() ? this.targetNode : this.domNode;
        domConstruct.place(`<div class='alert alert-danger'>List view swipe configuration error:<br>
        - ${message}</div>`, node, "first");
        window.logger.error(this.id, `configuration error: ${message}`);
    }

    private handleSwipe(element: HTMLElement, direction: Direction) {
        const guid = registry.byNode(element).getGuid();
        const context = this.createContext(guid);
        this.callMicroflow(direction, context);
        this.showPage(direction, context);
    }

    private callMicroflow(direction: Direction, context: mendix.lib.MxContext) {
        let microflow = "";
        if (direction === "right" && this.onSwipeActionRight === "callMicroflow") {
            microflow = this.onSwipeMicroflowRight;
        } else if (direction === "left" && this.onSwipeActionLeft === "callMicroflow") {
            microflow = this.onSwipeMicroflowLeft;
        }

        if (microflow) {
            window.mx.ui.action(microflow, {
                context,
                error: error =>
                    window.mx.ui.error(`An error occurred while executing action ${microflow}: ${error.message}`, true)
            });
        }
    }

    private showPage(direction: Direction, context: mendix.lib.MxContext) {
        let page = "";
        if (direction === "right" && this.onSwipeActionRight === "showPage") {
            page = this.onSwipePageRight;
        } else if (direction === "left" && this.onSwipeActionLeft === "showPage") {
            page = this.onSwipePageLeft;
        }

        if (page) {
            window.mx.ui.openForm(page, {
                context,
                error: error =>
                    window.mx.ui.error(`An error occurred while opening form ${page} : ${error.message}`)
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
dojoDeclare("com.mendix.widget.listviewswipe.ListViewSwipe", [ WidgetBase ], function(Source: any) {
    const result: any = {};
    for (const property in Source.prototype) {
        if (property !== "constructor" && Source.prototype.hasOwnProperty(property)) {
            result[property] = Source.prototype[property];
        }
    }
    return result;
}(ListViewSwipe));
