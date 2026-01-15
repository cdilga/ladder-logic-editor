Problems:

1. Pause and resume don't keep state. not sure why 
2. The sequence doesn't actually work as epxceted
  - Delay before first green / red - all lights are off. Init seq not defined well
  - After one cycle of EAST and WEST green, then yellow, we flash red for a second. Somethign changes for the North South for a brief moment, but the cycle doesn't go for the North South lights properly.
3. Save doesn't save editor content, it'll just save the default program. If multiple programs are in existance (should be current one) and should persist also to localstorage