
 BUNDLE  ./index.js
 ERROR  Error: Unable to resolve module @expo/vector-icons from C:\madrasone-MEC\frontend\src\screens\captain\CaptainOrders.tsx: @expo/vector-icons could not be found within the project or in these directories:
  node_modules
   8 |   FlatList,
   9 | } from 'react-native';
> 10 | import { Ionicons } from '@expo/vector-icons';
     |                           ^
  11 | import { colors } from '../../theme/colors';
  12 | import { OrderQueueCard } from '../../components/captain';
  13 | import { Order, User, OrderStatus } from '../../types';
    at ModuleResolver.resolveDependency (C:\madrasone-MEC\frontend\node_modules\metro\src\node-haste\DependencyGraph\ModuleResolution.js:172:15)
    at DependencyGraph.resolveDependency (C:\madrasone-MEC\frontend\node_modules\metro\src\node-haste\DependencyGraph.js:252:43)
    at C:\madrasone-MEC\frontend\node_modules\metro\src\lib\transformHelpers.js:163:21
    at resolveDependencies (C:\madrasone-MEC\frontend\node_modules\metro\src\DeltaBundler\buildSubgraph.js:43:25)
    at visit (C:\madrasone-MEC\frontend\node_modules\metro\src\DeltaBundler\buildSubgraph.js:81:30)
    at process.processTicksAndRejections (node:internal/process/task_queues:95:5)
    at async Promise.all (index 2)
    at async visit (C:\madrasone-MEC\frontend\node_modules\metro\src\DeltaBundler\buildSubgraph.js:90:5)
    at async Promise.all (index 6)
    at async visit (C:\madrasone-MEC\frontend\node_modules\metro\src\DeltaBundler\buildSubgraph.js:90:5)
 INFO  Reloading connected app(s)...
 BUNDLE  ./index.js
 ERROR  Error: Unable to resolve module @expo/vector-icons from C:\madrasone-MEC\frontend\src\screens\owner\OwnerAnalytics.tsx: @expo/vector-icons could not be found within the project or in these directories:
  node_modules
   6 |   StyleSheet,
   7 | } from 'react-native';
>  8 | import { Ionicons } from '@expo/vector-icons';
     |                           ^
   9 | import { colors } from '../../theme/colors';
  10 | import { Order, User, FoodItem } from '../../types';
  11 |
    at ModuleResolver.resolveDependency (C:\madrasone-MEC\frontend\node_modules\metro\src\node-haste\DependencyGraph\ModuleResolution.js:172:15)
    at DependencyGraph.resolveDependency (C:\madrasone-MEC\frontend\node_modules\metro\src\node-haste\DependencyGraph.js:252:43)
    at C:\madrasone-MEC\frontend\node_modules\metro\src\lib\transformHelpers.js:163:21
    at resolveDependencies (C:\madrasone-MEC\frontend\node_modules\metro\src\DeltaBundler\buildSubgraph.js:43:25)
    at visit (C:\madrasone-MEC\frontend\node_modules\metro\src\DeltaBundler\buildSubgraph.js:81:30)
    at async Promise.all (index 0)
    at async visit (C:\madrasone-MEC\frontend\node_modules\metro\src\DeltaBundler\buildSubgraph.js:90:5)
    at async Promise.all (index 6)
    at async visit (C:\madrasone-MEC\frontend\node_modules\metro\src\DeltaBundler\buildSubgraph.js:90:5)
    at async Promise.all (index 5)
