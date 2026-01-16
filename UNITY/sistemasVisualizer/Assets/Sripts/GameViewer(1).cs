using UnityEngine;
using UnityEngine.UI;
using UnityEngine.SceneManagement;

public class GameViewer : MonoBehaviour
{
    [SerializeField] private NodeGrid nodeGrid;
    [SerializeField] private Button leaveButton;
    
    private void Start()
    {
        if (nodeGrid == null)
        {
            Debug.LogError("NodeGrid not assigned!");
            return;
        }
        
        // Subscribe to socket events
        SocketManager.Instance.OnGridSetup += OnGridSetup;
        SocketManager.Instance.OnGridUpdate += OnGridUpdate;    
        
        // Setup leave button
        if (leaveButton != null)
        {
            leaveButton.onClick.AddListener(LeaveRoom);
        }
    }
    
    private void OnGridSetup(SocketManager.GridSetup gridSetup)
    {
        nodeGrid.SetupGrid(gridSetup);
    }
    
    private void OnGridUpdate(SocketManager.GridUpdate gridUpdate)
    {
        nodeGrid.UpdateGrid(gridUpdate);
    }
    
    private void LeaveRoom()
    {
        SocketManager.Instance.LeaveRoom();
        SceneManager.LoadScene("MainMenu");
    }
    
    private void OnDestroy()
    {
        if (SocketManager.Instance != null)
        {
            SocketManager.Instance.OnGridSetup -= OnGridSetup;
            SocketManager.Instance.OnGridUpdate -= OnGridUpdate;
        }
    }
}