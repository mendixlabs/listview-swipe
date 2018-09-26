# List view swipe
Enable swipe action on a list view

## Feature
 - Open Page after an item is swiped
 - Execute a microflow after an item is swiped
 - Show button behind a list view item
 - Make item gradually transparent during swiping
 - Animate hide of the item after swipe (for delete)
   - or reset it to original position (for open page)
 - Add background in a list view item
 - Add background to be shown after swipe
 - Items swiped out less the 30% will be canceled
 - List view click action and button on the foreground can be used as normal

## Dependencies
Mendix 7.18

## Demo project
http://listviewswipeout.mxapps.io

## How to use
 - Basic:
   - Add a list view
   - Place the widget directly underneath the list view
   - Provide the name of the listview in de widget
   - Add an 'On swipe action left' and/or 'On swipe action right' action
   - Items from the list can swiped left and right out of the screen depending on the configured actions.

 - Advanced: design the background
   - Create 1, 2, 3 or 4 containers inside the list view item:
     - The 'Swipe container' will be shown when the foreground is swiped away
     - The 'Hide container' will be shown after swiping, during hide animation
     - It is possible to create container for left and right or share them
   - Add the container names to their respective field in the widget configuration

<img src="/assets/ListViewSwipeAdvanced.png" width="250">

### Styling
 - Styling base class is .widget-listview-swipe
 - Default style, could be overwritten in CSS:
    - The 'widget-listview-swipe-foreground' will be white #FFFFF
    - The 'widget-listview-swipe-background' will be light light gray #d3d3d3
    - The 'widget-listview-swipe-background-after' will be gray #808080
  - Custom style applied to the .mx-listview-item ar normal
  - Custom style to all swipe widget could also be applied to:
    - .widget-listview-swipe-foreground
    - .widget-listview-swipe-background-left
    - .widget-listview-swipe-background-right
    - .widget-listview-swipe-background-shared
    - .widget-listview-swipe-background-after-left
    - .widget-listview-swipe-background-after-right
    - .widget-listview-swipe-background-after-shared
  - Interactive classes
    - .will-accept-swipe
    - .swiping-right
    - .swiping-left

### Disable swipe
For some use cases the swiping should be (conditional) disabled. This could be done by adding a CSS class `.widget-listview-swipe-disabled` on the list view item, to disable a single item. Or to listview to disable all swipe actions.
And other custom widgets, like `EnumClass`, could be used to change the classes dynamically at runtime. https://appstore.home.mendix.com/link/app/2641/


## Known issues
 - Swipe should be horizontal. When moved too much, it will cancel the swipe.
 - The 'Open page' should contain a page that has a dataview of the type 'Item entity' or non at all. However this is not check by the modeler nor the widget in runtime.

## Issues, suggestions and feature requests
We are actively maintaining this widget, please report any issues or suggestion for improvement at https://github.com/mendixlabs/listview-swipe/issues

## Development
Prerequisite: Install git, node package manager, webpack CLI, grunt CLI

To contribute, fork and clone.

    > git clone https://github.com/mendixlabs/listview-swipe.git

The code is in typescript. Use a typescript IDE of your choice, like opens source Visual Studio Code or WebStorm.

To set up the development environment, run:

    > npm install

Create a folder named `dist` in the project root.

Create a Mendix test project in the dist folder and rename its root folder to `dist/MxTestProject`. Or get the test project from https://github.com/mendixlabs/listview-swipe/releases/latest. Changes to the widget code shall be automatically pushed to this test project.

To automatically compile, bundle and push code changes to the running test project, run:

    > grunt
