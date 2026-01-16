using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class NodeGrid : MonoBehaviour
{
    [Serializable]
    public class Node
    {
        public enum JewelType
        {
            None = 0,
            Red = 1,
            Green = 2,
            Blue = 3,
            Yellow = 4,
            Orange = 5,
            Purple = 6,
            Shiny = 7
        }

        public int x, y;
        public JewelType type;
        public Node(JewelType type, int x, int y)
        {
            this.type = type;
            this.x = x;
            this.y = y;
        }
    }

    [Serializable]
    public class Grid
    {
        [Serializable]
        public class Column
        {
            public List<Node> nodes = new();
        }

        public List<Column> columns = new();

        [SerializeField]
        private int _playerId;
        public int PlayerId => _playerId;

        [SerializeField]
        private string _playerName;
        public string PlayerName => _playerName;

        public Grid(SocketManager.GridSetup gridSetup)
        {
            _playerId = gridSetup.playerId;
            _playerName = gridSetup.playerName;

            for (int x = 0; x < gridSetup.sizeX; x++)
            {
                columns.Add(new());
                for (int y = 0; y < gridSetup.sizeY; y++)
                {
                    columns[x].nodes.Add(new Node(Node.JewelType.None, x, y));
                }
            }
        }

        public Node GetNode(int x, int y)
        {
            return columns[x].nodes[y];
        }

        public void UpdateNode(Node updatedNode)
        {
            columns[updatedNode.x].nodes[updatedNode.y].type = updatedNode.type;
        }
    }

    private Grid _grid;

    [SerializeField] private GridVisualizer gridVisualizer;

    public void SetupGrid(SocketManager.GridSetup gridSetup)
    {
        // Create the data model
        _grid = new Grid(gridSetup);

        // Setup the visual representation
        if (gridVisualizer != null)
        {
            gridVisualizer.SetupGrid(gridSetup);
        }
        else
        {
            Debug.LogError("GridVisualizer not assigned in NodeGrid!");
        }
    }

    public void UpdateGrid(SocketManager.GridUpdate gridUpdate)
    {
        if (_grid == null)
        {
            Debug.LogError("Grid not initialized!  Call SetupGrid first.");
            return;
        }
        if (gridUpdate.updatedNodes != null)
        {
            foreach (var nodeUpdate in gridUpdate.updatedNodes)
            {
                var node = new Node((Node.JewelType)nodeUpdate.type, nodeUpdate.x, nodeUpdate.y);
                _grid.UpdateNode(node);
            }
        }

        // Update the visual representation
        if (gridVisualizer != null)
        {
            gridVisualizer.UpdateGrid(gridUpdate);
        }
    }
}