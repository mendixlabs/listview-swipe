# List view swipe
Enable swipe action on a list view

## Feature
 - Open Page after an item is swiped
 - Execute a microflow after an item is swiped
 - Make item gradually transparent during swiping
 - Animate hide of the item after swipe (for delete)
   - or reset it to original position (for open page)
 - Add background in a list view item
 - Add background to be shown after swipe
 - Items swiped out less the 20% will be canceled
 - List view click action and button on the foreground can be used as normal

## Dependencies
Mendix 6.

## Demo project
http://listviewswipeout.mxapps.io

## How to use
 - Basic
   - Place the widget in the same page/snippet as the list view
   - Provide the name of the listview
   - Add an 'On swipe left' and/or 'On swipe right' action
   - Items from the list can swiped left and right out of the screen depending on the configured actions.

 - Advanced: design the background
   - Create 3 containers inside the list view item :
     - The 'foreground' will always be shown
     - The 'background' will be shown when the foreground is swiped away
     - The 'background after swipe' will be shown before hiding.
   - Add the container names to their respective field in the widget configuration

<img src="/assets/ListViewSwipeAdvanced.png" width="250">

 - Default style, could be overwritten in CSS:
    - The 'foreground' will white #FFFFF
    - The 'background' will light light gray #d3d3d3
    - The 'background after swipe' gray #808080
  - Custom style applied to the .mx-listview-item should also be applied to:
    - .swipe-foreground
    - .swipe-background
    - .swipe-background-after

## Known issues
 - Swipe should be horizontal. When moved too much, it will cancel the swipe.
 - The 'Open page' should contain a page that has a dataview of the type 'Item entity' or non at all. However this is not check by the modeler nor the widget in runtime.

## Issues
Please report issues at https://github.com/mendixlabs/listview-swipe/issues
